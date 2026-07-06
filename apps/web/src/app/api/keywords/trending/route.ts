import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Trending searches in India (Google Trends), finance-filtered by default.
// ?all=1 returns the full national feed.
export async function GET(req: Request) {
  const session = await auth()
  if (!(session as any)?.workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === '1'
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const items = await prisma.trendingKeyword.findMany({
    where: { geo: 'IN', lastSeenAt: { gte: cutoff }, ...(all ? {} : { isFinance: true }) },
    orderBy: [{ approxTraffic: 'desc' }, { lastSeenAt: 'desc' }],
    take: 50,
  })
  const lastPolledAt = items.reduce<Date | null>(
    (max, i) => (!max || i.lastSeenAt > max ? i.lastSeenAt : max), null
  )
  return NextResponse.json({ items, lastPolledAt })
}
