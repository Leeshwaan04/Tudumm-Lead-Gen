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

    const callerMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: (session as any).user?.id! }
    })
    if (!callerMember || (callerMember.role !== 'OWNER' && callerMember.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    if (role === 'OWNER' && callerMember.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can assign owner role' }, { status: 403 })
    }

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

    const callerMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: (session as any).user?.id! }
    })
    if (!callerMember || (callerMember.role !== 'OWNER' && callerMember.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const member = await prisma.workspaceMember.findFirst({ where: { id, workspaceId } })
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (member.role === 'OWNER' && callerMember.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can remove another owner' }, { status: 403 })
    }

    await prisma.workspaceMember.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
