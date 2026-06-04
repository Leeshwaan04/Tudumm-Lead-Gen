import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { runQueue } from '@/lib/queue'
import { requireCredits, refundCredits, InsufficientCreditsError } from '@/lib/plan-gate'
import { guardExpensive, getClientIp } from '@/lib/rate-limit'

// Slug validation: alphanumerics, dashes, underscores only. No path traversal, no shell metachars.
const ACTOR_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/i

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Cost/abuse guard: scraping is the most expensive op (compute + proxy).
  const limited = guardExpensive('run', getClientIp(req), workspaceId, { perMinute: 20, perDay: 500 })
  if (limited) return NextResponse.json({ error: limited }, { status: 429 })

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  try {
    await requireCredits(workspaceId, 1, 'creditBalance', 'Actor run enqueue')
  } catch (err: any) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: err.message }, { status: 402 })
    }
    return NextResponse.json({ error: 'Failed to authorize credits' }, { status: 500 })
  }

  const { actorId, input } = await req.json()
  if (!actorId || typeof actorId !== 'string') {
    return NextResponse.json({ error: 'actorId is required' }, { status: 400 })
  }
  if (!ACTOR_SLUG_PATTERN.test(actorId)) {
    return NextResponse.json({ error: 'Invalid actorId format' }, { status: 400 })
  }

  // Resolve actor strictly: must exist in this workspace OR be a published marketplace actor.
  // Auto-creation is removed — it allowed arbitrary image names to be queued.
  let actor = await prisma.actor.findFirst({ where: { id: actorId, workspaceId } })
  if (!actor) actor = await prisma.actor.findFirst({ where: { slug: actorId, workspaceId } })
  if (!actor) {
    // Marketplace path: only PUBLISHED + isPublic actors are runnable across workspaces
    actor = await prisma.actor.findFirst({
      where: { 
        isPublic: true, 
        status: 'PUBLISHED',
        OR: [{ id: actorId }, { slug: actorId }]
      },
    })
  }
  if (!actor) {
    return NextResponse.json({ error: 'Actor not found or not accessible' }, { status: 404 })
  }

  const inputJson = JSON.stringify(input ?? {})
  const run = await prisma.run.create({
    data: { workspaceId, actorId: actor.id, input: inputJson, status: 'QUEUED' },
  })

  try {
    await runQueue.add('run', {
      runId: run.id,
      actorId: actor.id,
      workspaceId,
      input: input ?? {},
      actorSlug: actor.slug,
      imageName: `tudumm/actor-${actor.slug}:latest`,
    })
  } catch {
    // Redis not available in local dev — run stays QUEUED
    // Assuming run failed to enqueue, refund the credit
    await refundCredits(workspaceId, 1, 'creditBalance', 'Actor run enqueue failed')
    await prisma.run.update({ where: { id: run.id }, data: { status: 'FAILED', errorMessage: 'Queue error' } })
    return NextResponse.json({ error: 'Failed to enqueue run' }, { status: 500 })
  }

  return NextResponse.json(run, { status: 201 })
}
