// Unified mail sender.
//
// On Railway (and most PaaS) outbound SMTP ports (25/465/587) are blocked, so
// nodemailer connections to smtp.resend.com:465 time out (ETIMEDOUT). When a
// RESEND_API_KEY is present we therefore send via Resend's HTTPS API (port 443,
// never blocked). SMTP via nodemailer remains the fallback for local dev or any
// non-Resend provider.

import nodemailer from 'nodemailer'

export interface SendMailInput {
  to: string
  subject: string
  text?: string
  html?: string
  headers?: Record<string, string>
  from?: string
}

const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'Tudumm <noreply@tudumm.in>'

async function sendViaResend(input: SendMailInput): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from ?? DEFAULT_FROM,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      headers: input.headers,
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend API error ${res.status}: ${body}`)
  }
}

async function sendViaSmtp(input: SendMailInput): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    ignoreTLS: !process.env.SMTP_USER,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  } as any)

  await transporter.sendMail({
    from: input.from ?? DEFAULT_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    headers: input.headers,
  })
}

/** Send an email via Resend HTTP API (preferred) or SMTP fallback. */
export async function sendMail(input: SendMailInput): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(input)
  }
  return sendViaSmtp(input)
}
