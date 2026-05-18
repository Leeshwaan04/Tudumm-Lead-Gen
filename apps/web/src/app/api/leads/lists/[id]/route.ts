import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const list = await prisma.leadList.findFirst({
    where: { id, workspaceId },
    include: { leads: { orderBy: { createdAt: 'desc' } } },
  })
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(list)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const result = await prisma.leadList.updateMany({ where: { id, workspaceId }, data: body })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.leadList.findUnique({ where: { id } })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Cascade to leads is handled by the DB relation (onDelete: Cascade on lead.listId not set,
  // but we manually null out listId to avoid orphan issues; or just delete directly)
  const result = await prisma.leadList.deleteMany({ where: { id, workspaceId } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
