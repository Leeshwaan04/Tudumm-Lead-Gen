import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function mockEnrich(title?: string | null): { icpScore: number; emailStatus: string; aiSummary: string; outreachAngle: string } {
  const t = (title ?? '').toLowerCase()
  let icpScore: number
  let emailStatus: string

  if (/cto|vp|vice president|director|founder|co-founder/.test(t)) {
    icpScore = 85 + Math.floor(Math.random() * 11)
    emailStatus = 'VERIFIED'
  } else if (/manager|lead|head of/.test(t)) {
    icpScore = 70 + Math.floor(Math.random() * 15)
    emailStatus = 'VERIFIED'
  } else {
    icpScore = 55 + Math.floor(Math.random() * 15)
    emailStatus = 'RISKY'
  }

  return {
    icpScore,
    emailStatus,
    aiSummary: `Senior professional with ${title ?? 'an unspecified'} role. High potential for outreach.`,
    outreachAngle: icpScore >= 85 ? 'Executive-level value prop focusing on ROI' : icpScore >= 70 ? 'Manager-focused efficiency and team outcomes' : 'Individual contributor — focus on personal productivity',
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { leadIds, providers } = await req.json()
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds required' }, { status: 400 })
    }

    const results: Record<string, any> = {}
    let enriched = 0

    for (const leadId of leadIds) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } })
      if (!lead) { results[leadId] = { error: 'Not found' }; continue }

      const enrichment = mockEnrich(lead.title)

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          icpScore: enrichment.icpScore,
          emailStatus: enrichment.emailStatus,
          aiSummary: enrichment.aiSummary,
          outreachAngle: enrichment.outreachAngle,
        },
      })

      await prisma.enrichmentJob.create({
        data: {
          workspaceId,
          leadId,
          status: 'DONE',
          providers: JSON.stringify(providers ?? ['Hunter', 'Apollo', 'Snov']),
          results: JSON.stringify(enrichment),
          creditsUsed: 1,
        },
      })

      results[leadId] = enrichment
      enriched++
    }

    return NextResponse.json({ enriched, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
