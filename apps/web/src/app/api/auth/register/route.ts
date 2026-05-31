import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

async function sendVerificationEmail(to: string, token: string) {
  const url = `${process.env.APP_URL ?? 'https://app.tudumm.io'}/api/auth/verify?token=${token}`
  const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  } as any)
  await mailer.sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@tudumm.io',
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
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        emailVerified: false,
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
    // Store verify token in AuditLog (lightweight — no dedicated EmailToken model yet)
    const verifyToken = crypto.randomBytes(32).toString('hex')
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'email.verify_token',
        metadata: JSON.stringify({ token: verifyToken, expiresAt: Date.now() + 86_400_000 }),
      },
    }).catch(() => { /* non-fatal */ })

    // Fire-and-forget — mail failure must not block signup
    sendVerificationEmail(email, verifyToken).catch(err =>
      console.error('[Verification email failed]', err)
    )

    return NextResponse.json({ id: user.id, email: user.email })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
