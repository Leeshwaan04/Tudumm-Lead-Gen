import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Accept a workspace invite. Requires the user to be logged in (so their
// account is verified) and the invite email to match the logged-in user.
export async function POST(req: Request) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    const userEmail = session?.user?.email?.toLowerCase()
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Please sign in to accept this invite' }, { status: 401 })
    }

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

    const invite = await prisma.workspaceInvite.findUnique({ where: { token } })
    if (!invite || invite.acceptedAt) {
      return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 })
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
    }
    if (invite.email.toLowerCase() !== userEmail) {
      return NextResponse.json({ error: 'This invite was sent to a different email' }, { status: 403 })
    }

    // Check slot availability again at accept time
    const workspace = await prisma.workspace.findUnique({
      where: { id: invite.workspaceId },
      include: { _count: { select: { members: true } } },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace no longer exists' }, { status: 404 })
    if (workspace._count.members >= workspace.slots) {
      return NextResponse.json({ error: 'Workspace has no available seats' }, { status: 402 })
    }

    await prisma.$transaction([
      prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
        update: {},
        create: { workspaceId: invite.workspaceId, userId, role: invite.role },
      }),
      prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ])

    return NextResponse.json({ ok: true, workspaceId: invite.workspaceId })
  } catch (e: any) {
    console.error('[Accept invite error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
