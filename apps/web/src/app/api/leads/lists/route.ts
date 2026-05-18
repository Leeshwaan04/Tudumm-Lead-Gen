import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lists = await prisma.leadList.findMany({
    where: { workspaceId },
    include: { _count: { select: { leads: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const result = lists.map((l) => ({ ...l, leadCount: l._count.leads }))
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, source } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const list = await prisma.leadList.create({
    data: { workspaceId, name, description: description ?? null, source: source ?? null },
  })

  return NextResponse.json(list, { status: 201 })
}
