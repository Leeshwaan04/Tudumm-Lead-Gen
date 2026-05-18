import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const store = searchParams.get('store') === 'true'

  if (store) {
    const actors = await prisma.actor.findMany({
      where: { isPublic: true, status: 'PUBLISHED' },
      orderBy: { totalRuns: 'desc' },
      take: 50,
    })
    return NextResponse.json(actors)
  }

  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actors = await prisma.actor.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(actors)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  const userId = session?.user?.id
  if (!workspaceId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const actor = await prisma.actor.create({
    data: { ...body, workspaceId, authorId: userId },
  })
  return NextResponse.json(actor, { status: 201 })
}
