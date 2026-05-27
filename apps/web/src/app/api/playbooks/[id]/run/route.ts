import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const playbook = await prisma.playbook.findFirst({
      where: { id, OR: [{ workspaceId }, { isPublic: true }] },
    })
    if (!playbook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const stages: any[] = JSON.parse(playbook.stages ?? '[]')

    // For each stage, find or create a matching actor and queue a run
    const runIds: string[] = []
    for (const stage of stages) {
      const actorSlug = stage.actorSlug ?? stage.type
      if (!actorSlug) continue

      const actor = await prisma.actor.findFirst({
        where: { slug: actorSlug, workspaceId },
      }) ?? await prisma.actor.findFirst({
        where: { slug: actorSlug, isPublic: true },
      })

      if (!actor) continue

      const run = await prisma.run.create({
        data: {
          workspaceId,
          actorId: actor.id,
          input: JSON.stringify(stage.defaultInput ?? {}),
          status: 'QUEUED',
        },
      })
      runIds.push(run.id)
    }

    await prisma.playbook.update({
      where: { id },
      data: { totalRuns: { increment: 1 } },
    })

    return NextResponse.json({ playbookId: id, runIds, stages: stages.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
