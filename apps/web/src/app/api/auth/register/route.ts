import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import crypto from 'crypto'
import { sendMail } from '@/lib/mailer'

async function sendVerificationEmail(to: string, token: string) {
  const url = `${process.env.APP_URL ?? 'https://app.tudumm.io'}/api/auth/verify?token=${token}`
  await sendMail({
    to,
    subject: 'Verify your Tudumm account',
    text: `Click this link to verify your email:\n\n${url}\n\nExpires in 24 hours.`,
    html: `<p>Thanks for signing up! Click below to verify your email:</p>
<p><a href="${url}" style="background:#6d28d9;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Verify Email</a></p>
<p style="color:#6b7280;font-size:12px">This link expires in 24 hours.</p>`,
  })
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  if (!rateLimit(`register:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { name, email, password } = await req.json()
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`
    // Only require email verification when an SMTP server is actually configured —
    // otherwise the verification email can never arrive and the user would be
    // stuck. Without SMTP we auto-verify so signup is a clean, working flow.
    const smtpConfigured = !!process.env.SMTP_HOST && process.env.SMTP_HOST !== 'localhost'
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        emailVerified: !smtpConfigured,
        workspaceMembers: {
          create: {
            role: 'OWNER',
            workspace: {
              create: {
                name: `${name}'s Workspace`,
                slug,
                plan: 'STARTER',
                creditBalance: 10000,
                execHoursLimit: 10,
                slots: 3,
                aiCredits: 1000,
                emailCredits: 500,
              },
            },
          },
        },
      },
    })
    // Only generate + send a verification email when SMTP is configured.
    if (smtpConfigured) {
      const verifyToken = crypto.randomBytes(32).toString('hex')
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'email.verify_token',
          metadata: JSON.stringify({ token: verifyToken, expiresAt: Date.now() + 86_400_000 }),
        },
      }).catch(() => { /* non-fatal */ })
      sendVerificationEmail(email, verifyToken).catch(err =>
        console.error('[Verification email failed]', err)
      )
    }

    return NextResponse.json({ id: user.id, email: user.email })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
