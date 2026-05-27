import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 90)
  const since = new Date(Date.now() - days * 86_400_000)

  const [runs, workspace, leads, sequences, enrichmentJobs] = await Promise.all([
    prisma.run.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      select: { createdAt: true, creditsCost: true, status: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { creditBalance: true, plan: true, execHoursUsed: true, execHoursLimit: true },
    }),
    prisma.lead.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.sequence.count({ where: { workspaceId } }),
    prisma.enrichmentJob.count({ where: { workspaceId, createdAt: { gte: since } } }),
  ])

  // Group runs by day
  const byDay: Record<string, { credits: number; runs: number; failed: number }> = {}
  for (const run of runs) {
    const day = run.createdAt.toISOString().slice(0, 10)
    if (!byDay[day]) byDay[day] = { credits: 0, runs: 0, failed: 0 }
    byDay[day].credits += run.creditsCost ?? 0
    byDay[day].runs += 1
    if (run.status === 'FAILED') byDay[day].failed += 1
  }

  const timeline = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }))

  const totalRuns = runs.length
  const successRuns = runs.filter(r => r.status === 'SUCCEEDED').length
  const totalCreditsUsed = runs.reduce((s, r) => s + (r.creditsCost ?? 0), 0)

  return NextResponse.json({
    timeline,
    summary: {
      totalRuns,
      successRuns,
      failedRuns: runs.filter(r => r.status === 'FAILED').length,
      successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
      totalCreditsUsed,
      creditBalance: workspace?.creditBalance ?? 0,
      plan: workspace?.plan ?? 'STARTER',
      execHoursUsed: workspace?.execHoursUsed ?? 0,
      execHoursLimit: workspace?.execHoursLimit ?? 10,
      newLeads: leads,
      activeSequences: sequences,
      enrichmentJobs,
    },
  })
}
