import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const playbook = await prisma.playbook.findFirst({ where: { id, workspaceId } })
  if (!playbook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.playbook.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.stages !== undefined && { stages: JSON.stringify(body.stages) }),
      ...(body.workflowId !== undefined && { workflowId: body.workflowId }),
    },
  })

  return NextResponse.json({ ...updated, stages: JSON.parse(updated.stages) })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const playbook = await prisma.playbook.findFirst({ where: { id, workspaceId } })
  if (!playbook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.playbook.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
