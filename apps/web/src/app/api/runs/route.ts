import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
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
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { actorId, input } = await req.json()
  const run = await prisma.run.create({
    data: { workspaceId, actorId, input: JSON.stringify(input ?? {}), status: 'QUEUED' },
  })
  return NextResponse.json(run, { status: 201 })
}
