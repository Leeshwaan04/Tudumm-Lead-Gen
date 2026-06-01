import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { publishRunJob } from '@/lib/queue'

export async function GET(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

    const runs = await prisma.run.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { name: true, slug: true } },
        logs: { take: 5, orderBy: { timestamp: 'desc' } },
      },
    })
    return NextResponse.json(runs)
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { actorId, input } = await req.json()

    // Verify actor belongs to this workspace or is public
    let actor = await prisma.actor.findFirst({ where: { id: actorId, workspaceId } })
    if (!actor) {
      actor = await prisma.actor.findFirst({
        where: { 
          isPublic: true, 
          status: 'PUBLISHED',
          OR: [{ id: actorId }, { slug: actorId }]
        },
      })
    }
    if (!actor) return NextResponse.json({ error: 'Actor not found' }, { status: 404 })

    const run = await prisma.run.create({
      data: { workspaceId, actorId, input: JSON.stringify(input ?? {}), status: 'QUEUED' },
    })

    // Publish to execution queue (fire-and-forget — run stays QUEUED if Redis/AMQP unavailable)
    try {
      await publishRunJob({
        runId: run.id,
        workspaceId,
        actorId,
        imageName: `tudumm/actor-${actor.slug}:latest`,
        input: input ?? {},
      })
    } catch (qErr) {
      console.warn('[Queue] Failed to publish run job — will stay QUEUED:', qErr)
    }

    return NextResponse.json(run, { status: 201 })
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
