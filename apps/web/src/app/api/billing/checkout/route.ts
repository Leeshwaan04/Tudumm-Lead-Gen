import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://billing-service.railway.internal:8003'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'dev-secret'

const PLAN_PRICE_IDS: Record<string, string> = {
  GROW: process.env.STRIPE_PRICE_GROW ?? '',
  SCALE: process.env.STRIPE_PRICE_SCALE ?? '',
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  const userId = session?.user?.id
  if (!workspaceId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await req.json()
  if (!plan || !['GROW', 'SCALE'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan. Choose GROW or SCALE.' }, { status: 400 })
  }

  const priceId = PLAN_PRICE_IDS[plan]
  if (!priceId) {
    return NextResponse.json({ error: 'Stripe price ID not configured. Contact support.' }, { status: 503 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const res = await fetch(`${BILLING_SERVICE_URL}/billing/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
      'X-Workspace-ID': workspaceId,
    },
    body: JSON.stringify({ email: user.email, price_id: priceId, plan }),
  }).catch(() => null)

  if (!res || !res.ok) {
    const body = await res?.text().catch(() => '')
    return NextResponse.json({ error: 'Failed to initiate checkout', detail: body }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json(data, { status: 201 })
}
