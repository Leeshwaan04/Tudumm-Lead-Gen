import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const webhook = await prisma.webhook.findFirst({ where: { id, workspaceId } })
    if (!webhook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { event, payload } = await req.json()
    const payloadStr = JSON.stringify(payload)

    // SSRF protection: validate webhook URL before delivery
    function isValidWebhookUrl(rawUrl: string): boolean {
      try {
        const u = new URL(rawUrl)
        if (!['http:', 'https:'].includes(u.protocol)) return false
        const h = u.hostname
        if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.)/.test(h)) return false
        if (h === 'localhost' || h === '::1' || h.endsWith('.local')) return false
        return true
      } catch { return false }
    }
    if (!isValidWebhookUrl(webhook.url)) {
      return NextResponse.json({ error: 'Invalid or disallowed webhook URL' }, { status: 400 })
    }

    const signature = crypto.createHmac('sha256', webhook.secret).update(payloadStr).digest('hex')

    let statusCode: number | null = null
    let responseBody: string | null = null

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tudumm-Signature': `sha256=${signature}`,
          'X-Tudumm-Event': event,
        },
        body: payloadStr,
      })
      statusCode = res.status
      responseBody = await res.text()
    } catch (err: any) {
      responseBody = err.message
    }

    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: id,
        event,
        payload: payloadStr,
        statusCode,
        responseBody,
        deliveredAt: new Date(),
      },
    })

    await prisma.webhook.update({
      where: { id },
      data: { deliveryCount: { increment: 1 }, lastDeliveredAt: new Date() },
    })

    return NextResponse.json(delivery, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
