import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const webhook = await prisma.webhook.findFirst({ where: { id, workspaceId } })
    if (!webhook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { deliveredAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(deliveries)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
