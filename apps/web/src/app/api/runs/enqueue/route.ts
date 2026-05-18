import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { runQueue } from '@/lib/queue'

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { actorId, input } = await req.json()

  const actor = await prisma.actor.findFirst({ where: { id: actorId } })
  if (!actor) return NextResponse.json({ error: 'Actor not found' }, { status: 404 })

  const run = await prisma.run.create({
    data: { workspaceId, actorId, input: input ?? {}, status: 'QUEUED' },
  })

  await runQueue.add('run', {
    runId: run.id,
    actorId,
    workspaceId,
    input: input ?? {},
    actorSlug: actor.slug,
  })

  return NextResponse.json(run, { status: 201 })
}
