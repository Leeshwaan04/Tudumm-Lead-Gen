import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMember } from '@/lib/authz'
import nodemailer from 'nodemailer'
import { randomUUID } from 'crypto'
import { parseSequenceSteps, SequenceStepError } from '@/lib/sequence-steps'
import { interpolate, wrapHtmlEmail, unsubscribeUrl } from '@/lib/email'

// Feature flag — LinkedIn automation is not yet wired through browser-service.
const LINKEDIN_SEND_ENABLED = process.env.LINKEDIN_SEND_ENABLED === 'true'

const BATCH_SIZE = 50

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireMember()
    if (ctx instanceof NextResponse) return ctx
    const { workspaceId } = ctx

    const { id: sequenceId } = await params

    const sequence = await prisma.sequence.findFirst({ where: { id: sequenceId, workspaceId } })
    if (!sequence) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (sequence.status !== 'ACTIVE') return NextResponse.json({ error: 'Sequence is not active' }, { status: 400 })

    if (sequence.platform === 'linkedin' || sequence.platform === 'LINKEDIN') {
      if (!LINKEDIN_SEND_ENABLED) {
        return NextResponse.json(
          { error: 'LinkedIn sending is not yet enabled. Email sequences are currently supported.' },
          { status: 503 }
        )
      }
    }

    let steps
    try {
      steps = parseSequenceSteps(sequence.steps)
    } catch (e) {
      if (e instanceof SequenceStepError) {
        return NextResponse.json({ error: `Invalid sequence steps: ${e.message}` }, { status: 400 })
      }
      throw e
    }

    // ── B-7: Atomic claim/lease ──────────────────────────────────────────────
    // Generate a unique worker token and claim up to BATCH_SIZE due leads in a
    // single UPDATE ... WHERE claimedAt IS NULL. Concurrent invocations cannot
    // claim the same rows, so no double-send.
    const workerToken = randomUUID()
    const now = new Date()
    const staleBefore = new Date(now.getTime() - 10 * 60_000) // reclaim leases older than 10min

    await prisma.$executeRaw`
      UPDATE sequence_leads
      SET "claimedAt" = ${now}, "claimedBy" = ${workerToken}
      WHERE id IN (
        SELECT id FROM sequence_leads
        WHERE "sequenceId" = ${sequenceId}
          AND status IN ('PENDING', 'IN_PROGRESS')
          AND ("nextStepAt" IS NULL OR "nextStepAt" <= ${now})
          AND ("claimedAt" IS NULL OR "claimedAt" < ${staleBefore})
        ORDER BY "nextStepAt" ASC NULLS FIRST
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
    `

    const claimedLeads = await prisma.sequenceLead.findMany({
      where: { sequenceId, claimedBy: workerToken },
      include: { lead: true },
    })

    let processed = 0
    let errors = 0

    for (const sl of claimedLeads) {
      const stepIndex = sl.currentStep ?? 0
      const step = steps[stepIndex]

      // Past the last step → complete and release lease
      if (!step) {
        await prisma.sequenceLead.update({
          where: { id: sl.id },
          data: { status: 'COMPLETED', claimedAt: null, claimedBy: null },
        })
        continue
      }

      // Skip leads with no email (for email platform) or unsubscribed
      if ((sl.lead as any).unsubscribedAt) {
        await prisma.sequenceLead.update({
          where: { id: sl.id },
          data: { status: 'COMPLETED', claimedAt: null, claimedBy: null },
        })
        continue
      }

      try {
        const success = await executeStep(step, sl.lead, sequence.platform)

        if (success) {
          const nextStepIndex = stepIndex + 1
          const nextStep = steps[nextStepIndex]
          const nextStepAt = nextStep
            ? new Date(Date.now() + (nextStep.delayDays ?? 1) * 86_400_000)
            : null

          // ── B-8: wrap the three writes in a transaction so sentCount, the
          // lead-state update, and the activity row are always consistent.
          await prisma.$transaction([
            prisma.sequenceLead.update({
              where: { id: sl.id },
              data: {
                status: nextStepAt ? 'IN_PROGRESS' : 'COMPLETED',
                currentStep: nextStepIndex,
                lastStepAt: now,
                nextStepAt,
                claimedAt: null,
                claimedBy: null,
              },
            }),
            prisma.leadActivity.create({
              data: {
                leadId: sl.leadId,
                type: sequence.platform === 'linkedin' ? 'linkedin_sent' : 'email_sent',
                note: `Step ${stepIndex + 1}: ${step.subject ?? step.message ?? 'message sent'}`,
              },
            }),
            prisma.sequence.update({
              where: { id: sequenceId },
              data: { sentCount: { increment: 1 } },
            }),
          ])

          processed++
        } else {
          // Send returned false (e.g. no email) — release lease, leave for review
          await prisma.sequenceLead.update({
            where: { id: sl.id },
            data: { status: 'FAILED', claimedAt: null, claimedBy: null },
          })
          errors++
        }
      } catch (err) {
        console.error(`[Sequence] Step failed for lead ${sl.leadId}:`, err)
        // Release the lease so it can be retried next run
        await prisma.sequenceLead.update({
          where: { id: sl.id },
          data: { claimedAt: null, claimedBy: null },
        })
        errors++
      }
    }

    return NextResponse.json({ processed, errors, total: claimedLeads.length })
  } catch (e: any) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function executeStep(step: any, lead: any, platform: string): Promise<boolean> {
  if (platform === 'EMAIL' || platform === 'MIXED' || platform === 'email') {
    return sendEmail(step, lead)
  }
  if (!LINKEDIN_SEND_ENABLED) {
    throw new Error('LinkedIn send not yet wired through browser-service')
  }
  // TODO: POST to browser-service /linkedin/send when implemented (Sprint #1)
  return false
}

async function sendEmail(step: any, lead: any): Promise<boolean> {
  if (!lead.email) return false

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    ignoreTLS: !process.env.SMTP_USER,
  } as any)

  const subject = interpolate(step.subject ?? 'Following up', lead)
  const textBody = interpolate(step.message ?? step.body ?? '', lead)
  const unsubUrl = unsubscribeUrl(lead.id)

  // B-5 / M-15: HTML-escaped body + CAN-SPAM unsubscribe footer + List-Unsubscribe header
  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@tudumm.io',
    to: lead.email,
    subject,
    text: `${textBody}\n\n---\nUnsubscribe: ${unsubUrl}`,
    html: wrapHtmlEmail(textBody, lead, unsubUrl),
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
  return true
}
