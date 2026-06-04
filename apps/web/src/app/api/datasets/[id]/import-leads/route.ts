import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { downloadJSON } from '@/lib/storage'

type Item = Record<string, any>

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/** Pull candidate lead records out of one scraped/enriched item. */
function leadsFromItem(it: Item): Array<Record<string, any>> {
  // Collect emails from the common shapes scrapers produce.
  const emails = new Set<string>()
  if (typeof it.email === 'string' && EMAIL_RE.test(it.email)) emails.add(it.email.toLowerCase())
  if (Array.isArray(it.emails)) for (const e of it.emails) if (typeof e === 'string' && EMAIL_RE.test(e)) emails.add(e.toLowerCase())

  const fullName = it.fullName || it.name || [it.firstName, it.lastName].filter(Boolean).join(' ') || null
  const social = it.social || {}
  const base = {
    firstName: it.firstName ?? null,
    lastName: it.lastName ?? null,
    title: it.title ?? it.position ?? it.headline ?? null,
    company: it.company ?? it.openGraph?.site_name ?? null,
    companyDomain: it.domain ?? it.companyDomain ?? null,
    phone: Array.isArray(it.phones) ? it.phones[0] ?? null : (it.phone ?? null),
    linkedinUrl: it.linkedinUrl ?? social.linkedin ?? null,
    twitterUrl: it.twitterUrl ?? social.twitter ?? null,
    instagramUrl: it.instagramUrl ?? social.instagram ?? null,
    githubUrl: it.githubUrl ?? social.github ?? null,
    icpScore: typeof it.icpScore === 'number' ? it.icpScore : null,
    aiSummary: it.aiSummary ?? null,
  }

  if (emails.size === 0) {
    // No email — still importable if there's a name or company to work with.
    if (!fullName && !base.company) return []
    return [{ ...base, fullName: fullName || base.company, email: null }]
  }
  return Array.from(emails).map(email => ({ ...base, email, fullName: fullName || email }))
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const dataset = await prisma.dataset.findFirst({ where: { id, workspaceId } })
    if (!dataset) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!dataset.s3Key) return NextResponse.json({ error: 'Dataset has no stored items' }, { status: 400 })

    // Optional: import into a specific list.
    const body = await req.json().catch(() => ({}))
    const listId: string | null = body.listId ?? null

    let items: Item[]
    try {
      items = await downloadJSON<Item[]>(dataset.s3Key)
    } catch {
      return NextResponse.json({ error: 'Could not read dataset items from storage' }, { status: 502 })
    }
    if (!Array.isArray(items)) items = []

    // Build candidate leads, dedupe within the batch by email.
    const candidates: Record<string, any>[] = []
    const seenEmails = new Set<string>()
    for (const it of items) {
      for (const lead of leadsFromItem(it)) {
        if (lead.email) {
          if (seenEmails.has(lead.email)) continue
          seenEmails.add(lead.email)
        }
        candidates.push(lead)
      }
    }

    // Skip emails that already exist in this workspace.
    const existing = await prisma.lead.findMany({
      where: { workspaceId, email: { in: Array.from(seenEmails) }, deletedAt: null },
      select: { email: true },
    })
    const existingEmails = new Set(existing.map(e => (e.email ?? '').toLowerCase()))

    let imported = 0, skipped = 0
    for (const c of candidates) {
      if (c.email && existingEmails.has(c.email)) { skipped++; continue }
      await prisma.lead.create({
        data: {
          workspaceId,
          listId,
          email: c.email,
          emailStatus: c.email ? 'FOUND' : null,
          firstName: c.firstName,
          lastName: c.lastName,
          fullName: c.fullName,
          title: c.title,
          company: c.company,
          companyDomain: c.companyDomain,
          phone: c.phone,
          linkedinUrl: c.linkedinUrl,
          twitterUrl: c.twitterUrl,
          instagramUrl: c.instagramUrl,
          githubUrl: c.githubUrl,
          icpScore: c.icpScore,
          aiSummary: c.aiSummary,
          source: `Dataset: ${dataset.name}`.slice(0, 120),
        },
      }).then(() => { imported++ }).catch(() => { skipped++ })
    }

    if (listId) {
      await prisma.leadList.update({ where: { id: listId }, data: { leadCount: { increment: imported } } }).catch(() => {})
    }

    return NextResponse.json({ imported, skipped, total: candidates.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
