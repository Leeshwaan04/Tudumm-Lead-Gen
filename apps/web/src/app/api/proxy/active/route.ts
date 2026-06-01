import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Internal endpoint — called by browser-service/sequence-executor to get an active proxy
// Protected by X-Internal-Secret header
export async function GET(req: Request) {
  const secret = req.headers.get('x-internal-secret')
  if (process.env.INTERNAL_SECRET && secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const type = searchParams.get('type') // RESIDENTIAL | DATACENTER | ISP | MOBILE

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const where: any = { workspaceId, isActive: true }
  if (type) where.type = type.toUpperCase()

  const config = await prisma.proxyConfig.findFirst({
    where,
    orderBy: { lastUsedAt: 'asc' },
  })

  if (!config) return NextResponse.json({ error: 'No active proxy config found' }, { status: 404 })

  // Update lastUsedAt + increment requestCount
  await prisma.proxyConfig.update({
    where: { id: config.id },
    data: { lastUsedAt: new Date(), requestCount: { increment: 1 } },
  })

  // Return credentials for use — never returned to end users (internal only)
  let credentials: Record<string, string> = {}
  try { credentials = JSON.parse(config.credentials) } catch { /* ignore */ }

  return NextResponse.json({
    id: config.id,
    type: config.type,
    country: config.country,
    provider: config.provider,
    credentials,
  })
}
