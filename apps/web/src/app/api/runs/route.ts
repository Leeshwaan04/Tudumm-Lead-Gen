import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const runs = await prisma.run.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
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

    // Verify actor belongs to this workspace
    const actor = await prisma.actor.findFirst({ where: { id: actorId, workspaceId } })
    if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const run = await prisma.run.create({
      data: { workspaceId, actorId, input: JSON.stringify(input ?? {}), status: 'QUEUED' },
    })
    return NextResponse.json(run, { status: 201 })
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
