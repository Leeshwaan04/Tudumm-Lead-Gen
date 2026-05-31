import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMember, requireAdmin } from '@/lib/authz'
import { randomBytes } from 'crypto'
import nodemailer from 'nodemailer'

function getMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  } as any)
}

async function sendInviteEmail(to: string, acceptUrl: string, workspaceName: string) {
  const mailer = getMailer()
  await mailer.sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@tudumm.io',
    to,
    subject: `You've been invited to ${workspaceName} on Tudumm`,
    text: `You've been invited to join ${workspaceName} on Tudumm.\n\nAccept your invitation here:\n${acceptUrl}\n\nThis link expires in 7 days.`,
    html: `<p>You've been invited to join <strong>${workspaceName}</strong> on Tudumm.</p>
<p><a href="${acceptUrl}" style="background:#6d28d9;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Accept Invitation</a></p>
<p style="color:#6b7280;font-size:12px">This link expires in 7 days. If you didn't expect this invitation, you can ignore this email.</p>`,
  })
}

const INVITE_TTL_DAYS = 7

export async function GET() {
  const ctx = await requireMember()
  if (ctx instanceof NextResponse) return ctx

  const [members, invites] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.workspaceInvite.findMany({
      where: { workspaceId: ctx.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({ members, pendingInvites: invites })
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAdmin()
    if (ctx instanceof NextResponse) return ctx
    const { workspaceId, role: callerRole } = ctx

    const { email, role } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 })
    }

    if (role === 'OWNER' && callerRole !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can assign owner role' }, { status: 403 })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { _count: { select: { members: true } } },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    if (workspace._count.members >= workspace.slots) {
      return NextResponse.json({ error: 'No available member slots. Please upgrade your plan.' }, { status: 402 })
    }

    // If the user already exists AND is already a member, reject.
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      })
      if (existingMember) return NextResponse.json({ error: 'Already a member' }, { status: 409 })
    }

    // B-6: create a pending invite with a token instead of a ghost account.
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000)

    const invite = await prisma.workspaceInvite.upsert({
      where: { workspaceId_email: { workspaceId, email: normalizedEmail } },
      update: { token, role: role ?? 'MEMBER', invitedBy: ctx.userId, expiresAt, acceptedAt: null },
      create: { workspaceId, email: normalizedEmail, role: role ?? 'MEMBER', token, invitedBy: ctx.userId, expiresAt },
    })

    const acceptUrl = `${process.env.APP_URL ?? 'https://app.tudumm.io'}/accept-invite?token=${token}`

    // Send invite email — fire-and-forget so a mail failure doesn't block the response
    sendInviteEmail(normalizedEmail, acceptUrl, workspace.name).catch(err =>
      console.error('[Invite email failed]', err)
    )

    return NextResponse.json(
      { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt, acceptUrl },
      { status: 201 }
    )
  } catch (e: any) {
    console.error('[Members invite error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
