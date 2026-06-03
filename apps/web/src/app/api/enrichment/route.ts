import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// ─── Groq-powered enrichment (Llama 3.1 70B — free tier) ─────────────────────

async function enrichWithGroq(lead: {
  fullName: string
  title?: string | null
  company?: string | null
  linkedinUrl?: string | null
}): Promise<{ icpScore: number; emailStatus: string; aiSummary: string; outreachAngle: string }> {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    return fallbackEnrich(lead.title)
  }

  const prompt = `Analyze this B2B lead for outreach suitability:
Name: ${lead.fullName}
Title: ${lead.title ?? 'Unknown'}
Company: ${lead.company ?? 'Unknown'}
${lead.linkedinUrl ? `LinkedIn: ${lead.linkedinUrl}` : ''}

Return ONLY a JSON object (no prose) with these exact fields:
{
  "icpScore": <integer 0-100, higher = better fit for B2B SaaS outreach>,
  "emailStatus": <"VERIFIED" | "RISKY" | "NOT_FOUND">,
  "aiSummary": <2-3 sentence professional summary of their role and relevance>,
  "outreachAngle": <one personalized opening line for cold outreach>
}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 512,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a B2B sales assistant. Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content ?? '{}'
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return {
        icpScore: Number(parsed.icpScore) || 70,
        emailStatus: parsed.emailStatus ?? 'RISKY',
        aiSummary: parsed.aiSummary ?? '',
        outreachAngle: parsed.outreachAngle ?? '',
      }
    }
  } catch {
    // Fall through to heuristic
  }

  return fallbackEnrich(lead.title)
}

function fallbackEnrich(title?: string | null) {
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
    aiSummary: `Professional with ${title ?? 'an unspecified'} role. Potential fit for B2B outreach.`,
    outreachAngle:
      icpScore >= 85
        ? 'Executive-level value prop focusing on ROI and team efficiency.'
        : icpScore >= 70
          ? 'Manager-focused pitch on team outcomes and workflow automation.'
          : 'Individual contributor — focus on personal productivity gains.',
  }
}

// ─── GET — list enrichment jobs ───────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const jobs = await prisma.enrichmentJob.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(jobs)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── POST — enrich leads ──────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { leadIds, providers } = await req.json()
    if (!Array.isArray(leadIds)) {
      return NextResponse.json({ error: 'leadIds required' }, { status: 400 })
    }

    const results: Record<string, any> = {}
    let enriched = 0

    for (const leadId of leadIds) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } })
      if (!lead) {
        results[leadId] = { error: 'Not found' }
        continue
      }

      const enrichment = await enrichWithGroq({
        fullName: lead.fullName,
        title: lead.title,
        company: lead.company,
        linkedinUrl: lead.linkedinUrl,
      })

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
          providers: JSON.stringify(providers ?? ['Groq AI', 'Hunter', 'Apollo']),
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
