import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, title, company, linkedin } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      icpScore: Math.floor(Math.random() * 40) + 60,
      summary: `${name} is a ${title} at ${company}. Based on their role and company profile, they appear to be a strong fit for outreach.`,
      angle: `Hi ${name.split(' ')[0]}, I noticed your work at ${company} and wanted to connect about how we help ${title.includes('Sales') ? 'sales' : 'engineering'} teams automate their workflows.`,
    })
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Analyze this lead for B2B outreach: Name: ${name}, Title: ${title}, Company: ${company}${linkedin ? `, LinkedIn: ${linkedin}` : ''}.

Return JSON with: icpScore (0-100 integer), summary (2-3 sentences about their role/fit), angle (one personalized opening line for cold outreach).`
      }]
    }),
  })

  const data = await response.json()
  const text = data.content?.[0]?.text ?? '{}'
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? '{}')
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ icpScore: 70, summary: text, angle: '' })
  }
}
