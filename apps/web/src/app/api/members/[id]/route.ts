import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { role } = await req.json()
    if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 })

    const result = await prisma.workspaceMember.updateMany({
      where: { id, workspaceId },
      data: { role },
    })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.workspaceMember.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const member = await prisma.workspaceMember.findFirst({ where: { id, workspaceId } })
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (member.role === 'OWNER') return NextResponse.json({ error: 'Cannot remove owner' }, { status: 403 })

    await prisma.workspaceMember.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
