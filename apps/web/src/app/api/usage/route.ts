import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const runs = await prisma.run.findMany({
    where: { workspaceId, createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, creditsCost: true, status: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by day
  const byDay: Record<string, { credits: number; runs: number; items: number }> = {}
  for (const run of runs) {
    const day = run.createdAt.toISOString().slice(0, 10)
    if (!byDay[day]) byDay[day] = { credits: 0, runs: 0, items: 0 }
    byDay[day].credits += run.creditsCost
    byDay[day].runs += 1
  }

  const data = Object.entries(byDay).map(([date, stats]) => ({
    date,
    ...stats,
  }))

  return NextResponse.json(data)
}
