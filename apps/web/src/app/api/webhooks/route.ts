import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const webhooks = await prisma.webhook.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  const parsed = webhooks.map(({ secret, ...w }) => ({ ...w, events: JSON.parse(w.events) }))
  return NextResponse.json(parsed)
}

function isValidWebhookUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    const h = u.hostname
    // Block private/loopback ranges
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.)/.test(h)) return false
    if (h === 'localhost' || h === '::1' || h.endsWith('.local')) return false
    return true
  } catch { return false }
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, url, events, secret } = await req.json()
  if (!name || !url) return NextResponse.json({ error: 'name and url are required' }, { status: 400 })

  if (!isValidWebhookUrl(url)) {
    return NextResponse.json({ error: 'Invalid or disallowed webhook URL' }, { status: 400 })
  }

  const webhookSecret = secret ?? crypto.randomBytes(24).toString('hex')

  const webhook = await prisma.webhook.create({
    data: {
      workspaceId,
      name,
      url,
      events: JSON.stringify(events ?? []),
      secret: webhookSecret,
    },
  })

  return NextResponse.json({ ...webhook, events: JSON.parse(webhook.events) }, { status: 201 })
}
