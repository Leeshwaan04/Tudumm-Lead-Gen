// In-process scheduler — runs inside the always-on worker. Every tick it:
//  1. Fires due actor schedules (cronExpr) → enqueues a run, advances nextRunAt
//  2. Enqueues sequences that have ready leads
//  3. Resets LinkedIn daily limits once per UTC day
import { prisma } from './db'
import { runQueue, type RunJobData } from './queue'
import { publishSequenceJob } from './queues/sequence-queue'
import { nextRunAt } from './cron'

let lastDailyReset = ''

async function fireDueSchedules() {
  const now = new Date()

  // Backfill: ACTIVE schedules missing a nextRunAt (resumed, or created before
  // scheduling was wired) get one computed so they enter the firing cycle.
  const missing = await prisma.schedule.findMany({
    where: { status: 'ACTIVE', nextRunAt: null },
    select: { id: true, cronExpr: true, timezone: true },
  })
  for (const s of missing) {
    await prisma.schedule.update({
      where: { id: s.id },
      data: { nextRunAt: nextRunAt(s.cronExpr, s.timezone, now) },
    }).catch(() => {})
  }

  const due = await prisma.schedule.findMany({
    where: { status: 'ACTIVE', nextRunAt: { not: null, lte: now } },
    include: { actor: true },
  })

  for (const sched of due) {
    try {
      const run = await prisma.run.create({
        data: {
          workspaceId: sched.workspaceId,
          actorId: sched.actorId,
          input: sched.input,
          status: 'QUEUED',
        },
      })
      const job: RunJobData = {
        runId: run.id,
        actorId: sched.actorId,
        workspaceId: sched.workspaceId,
        input: (() => { try { return JSON.parse(sched.input) } catch { return {} } })(),
        actorSlug: sched.actor?.slug,
        imageName: `tudumm/actor-${sched.actor?.slug ?? sched.actorId}:latest`,
      }
      await runQueue.add('run', job)

      await prisma.schedule.update({
        where: { id: sched.id },
        data: {
          lastRunAt: now,
          lastRunStatus: 'QUEUED',
          nextRunAt: nextRunAt(sched.cronExpr, sched.timezone, now),
        },
      })
      console.log(`[Scheduler] Fired schedule ${sched.name} (${sched.id}) → run ${run.id}`)
    } catch (err) {
      console.error(`[Scheduler] Failed to fire schedule ${sched.id}:`, err)
    }
  }
  return due.length
}

async function enqueueReadySequences() {
  const now = new Date()
  const ready = await prisma.sequenceLead.findMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      OR: [{ nextStepAt: null }, { nextStepAt: { lte: now } }],
      sequence: { status: 'ACTIVE' },
    },
    select: { sequenceId: true, sequence: { select: { workspaceId: true } } },
    distinct: ['sequenceId'],
  })
  for (const item of ready) {
    await publishSequenceJob({ sequenceId: item.sequenceId, workspaceId: item.sequence.workspaceId })
  }
  return ready.length
}

async function resetDailyLimitsIfNeeded() {
  const today = new Date().toISOString().slice(0, 10)
  if (today === lastDailyReset) return
  lastDailyReset = today
  const result = await prisma.linkedInSession.updateMany({
    where: { dailyUsed: { gt: 0 } },
    data: { dailyUsed: 0 },
  })
  if (result.count > 0) console.log(`[Scheduler] Reset daily limits on ${result.count} LinkedIn sessions`)
}

async function tick() {
  try {
    const [schedules, sequences] = await Promise.all([
      fireDueSchedules(),
      enqueueReadySequences(),
    ])
    await resetDailyLimitsIfNeeded()
    if (schedules > 0 || sequences > 0) {
      console.log(`[Scheduler] tick — schedules:${schedules} sequences:${sequences}`)
    }
  } catch (err) {
    console.error('[Scheduler] tick error:', err)
  }
}

export function startScheduler(intervalMs = 60_000) {
  console.log(`[Scheduler] started — ticking every ${intervalMs / 1000}s`)
  tick() // run immediately on boot
  return setInterval(tick, intervalMs)
}
