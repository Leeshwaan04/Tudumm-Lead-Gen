import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMember, requireAdmin } from '@/lib/authz'
import crypto from 'crypto'

export async function GET() {
  const ctx = await requireMember()
  if (ctx instanceof NextResponse) return ctx

  const webhooks = await prisma.webhook.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(webhooks)
}

export async function POST(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json()
  const { name, url, events } = body
  if (!name || !url) {
    return NextResponse.json({ error: 'name and url are required' }, { status: 400 })
  }
  // Validate URL is http(s) and absolute
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return NextResponse.json({ error: 'url must be http(s)' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }

  const webhook = await prisma.webhook.create({
    data: {
      workspaceId: ctx.workspaceId,
      name,
      url,
      events: JSON.stringify(events || []),
      secret: crypto.randomBytes(24).toString('hex'),
    },
  })

  return NextResponse.json(webhook, { status: 201 })
}
