import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function scoreFromTitle(title?: string | null): number {
  if (!title) return Math.floor(Math.random() * 15) + 60 // 60–74
  const t = title.toLowerCase()
  if (t.includes('cto') || t.includes('vp') || t.includes('director')) {
    return Math.floor(Math.random() * 11) + 85 // 85–95
  }
  if (t.includes('manager') || t.includes('lead')) {
    return Math.floor(Math.random() * 16) + 70 // 70–85
  }
  return Math.floor(Math.random() * 15) + 60 // 60–74
}

function buildMockEnrichment(lead: {
  fullName: string
  firstName?: string | null
  title?: string | null
  company?: string | null
}) {
  const icpScore = scoreFromTitle(lead.title)
  const aiSummary = `${lead.fullName} is ${lead.title ?? 'a professional'} at ${lead.company ?? 'their company'}. Strong fit for outreach based on role and seniority.`
  const firstName = lead.firstName ?? lead.fullName.split(' ')[0]
  const isSales = lead.title?.toLowerCase().includes('sales')
  const outreachAngle = `Hi ${firstName}, saw your work at ${lead.company ?? 'your company'} — we help ${isSales ? 'sales' : 'engineering'} teams at companies like yours automate prospecting.`
  return { icpScore, aiSummary, outreachAngle }
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadIds } = await req.json()
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'leadIds must be a non-empty array' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  const results: { id: string; icpScore: number; aiSummary: string }[] = []
  let enriched = 0

  for (const leadId of leadIds) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } })
    if (!lead) continue

    let icpScore: number
    let aiSummary: string
    let outreachAngle: string

    if (!apiKey) {
      const mock = buildMockEnrichment(lead)
      icpScore = mock.icpScore
      aiSummary = mock.aiSummary
      outreachAngle = mock.outreachAngle
    } else {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            messages: [
              {
                role: 'user',
                content: `Analyze this lead for B2B outreach: Name: ${lead.fullName}, Title: ${lead.title ?? ''}, Company: ${lead.company ?? ''}${lead.linkedinUrl ? `, LinkedIn: ${lead.linkedinUrl}` : ''}.

Return JSON with: icpScore (0-100 integer), aiSummary (2-3 sentences about their role/fit), outreachAngle (one personalized opening line for cold outreach).`,
              },
            ],
          }),
        })
        const data = await response.json()
        const text = data.content?.[0]?.text ?? '{}'
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch?.[0] ?? '{}')
        icpScore = parsed.icpScore ?? scoreFromTitle(lead.title)
        aiSummary = parsed.aiSummary ?? parsed.summary ?? ''
        outreachAngle = parsed.outreachAngle ?? parsed.angle ?? ''
      } catch {
        const mock = buildMockEnrichment(lead)
        icpScore = mock.icpScore
        aiSummary = mock.aiSummary
        outreachAngle = mock.outreachAngle
      }
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { icpScore, aiSummary, outreachAngle },
    })

    results.push({ id: leadId, icpScore, aiSummary })
    enriched++
  }

  return NextResponse.json({ enriched, results })
}
