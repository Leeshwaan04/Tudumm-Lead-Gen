import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const data: any = {}
  if (body.isActive !== undefined) data.isActive = body.isActive
  if (body.url !== undefined) data.url = body.url
  if (body.events !== undefined) data.events = JSON.stringify(body.events)

  const result = await prisma.webhook.updateMany({ where: { id, workspaceId }, data })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.webhook.findUnique({ where: { id } })
  return NextResponse.json({ ...updated, events: JSON.parse(updated!.events) })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await prisma.webhook.deleteMany({ where: { id, workspaceId } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
