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

  const parsed = webhooks.map((w) => ({ ...w, events: JSON.parse(w.events) }))
  return NextResponse.json(parsed)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, url, events, secret } = await req.json()
  if (!name || !url) return NextResponse.json({ error: 'name and url are required' }, { status: 400 })

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
