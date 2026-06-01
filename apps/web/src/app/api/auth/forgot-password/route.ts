import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

async function sendResetEmail(to: string, token: string) {
  const url = `${process.env.APP_URL ?? 'https://app.tudumm.io'}/reset-password?token=${token}`
  const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  } as any)
  await mailer.sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@tudumm.io',
    to,
    subject: 'Reset your Tudumm password',
    text: `Click this link to reset your password:\n\n${url}\n\nExpires in 1 hour.`,
    html: `<p>You requested a password reset. Click below to set a new password:</p>
<p><a href="${url}" style="background:#6d28d9;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Reset Password</a></p>
<p style="color:#6b7280;font-size:12px">This link expires in 1 hour. If you didn't request this, you can safely ignore it.</p>`,
  })
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  if (!rateLimit(`forgot-password:${ip}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ ok: true })
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    const token = crypto.randomBytes(32).toString('hex')
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'password.reset_token',
        metadata: JSON.stringify({ token, expiresAt: Date.now() + 3_600_000 }),
      },
    })

    sendResetEmail(user.email, token).catch(err =>
      console.error('[Reset email failed]', err)
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ ok: true })
  }
}
