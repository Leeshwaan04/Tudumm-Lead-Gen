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
  if (body.credentials !== undefined) data.credentials = JSON.stringify(body.credentials)

  const result = await prisma.proxyConfig.updateMany({ where: { id, workspaceId }, data })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.proxyConfig.findUnique({ where: { id } })
  return NextResponse.json({ ...updated, credentials: JSON.parse(updated!.credentials) })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await prisma.proxyConfig.deleteMany({ where: { id, workspaceId } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
