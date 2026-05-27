import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { runQueue } from '@/lib/queue'

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { actorId, input } = await req.json()

  // Find actor — if not found by id, try by slug (store actors use slugs as ids)
  // Always filter by workspaceId to prevent cross-workspace access
  let actor = await prisma.actor.findFirst({ where: { id: actorId, workspaceId } })
  if (!actor) actor = await prisma.actor.findFirst({ where: { slug: actorId, workspaceId } })
  // Auto-create ephemeral actor record for store/marketplace actors
  if (!actor) {
    const userId = session?.user?.id!
    actor = await prisma.actor.create({
      data: { workspaceId, authorId: userId, name: actorId, slug: actorId + '-' + Date.now(), description: '', status: 'DRAFT' },
    })
  }

  const inputJson = JSON.stringify(input ?? {})
  const run = await prisma.run.create({
    data: { workspaceId, actorId: actor.id, input: inputJson, status: 'QUEUED' },
  })

  try {
    await runQueue.add('run', { runId: run.id, actorId: actor.id, workspaceId, input: input ?? {}, actorSlug: actor.slug, imageName: `tudumm/actor-${actor.slug}:latest` })
  } catch {
    // Redis not available in local dev — run stays QUEUED
  }

  return NextResponse.json(run, { status: 201 })
}
