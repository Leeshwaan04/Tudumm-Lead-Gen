import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { SEED_KEYWORDS } from '@/lib/keyword-radar'

// GET → workspace watchlist with latest interest + 24h sparkline + linked capture page stats.
export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keywords = await prisma.trackedKeyword.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      snapshots: { orderBy: { capturedAt: 'desc' }, take: 48 }, // ~24h at 30-min spacing
    },
  })

  const pageIds = keywords.map(k => k.capturePageId).filter(Boolean) as string[]
  const pages = pageIds.length
    ? await prisma.capturePage.findMany({ where: { id: { in: pageIds } } })
    : []
  const pageById = new Map(pages.map(p => [p.id, p]))

  const items = keywords.map(k => {
    const snaps = [...k.snapshots].reverse() // oldest → newest
    const latest = snaps[snaps.length - 1]
    const prev = snaps[snaps.length - 2]
    const page = k.capturePageId ? pageById.get(k.capturePageId) : undefined
    let meta: any = null
    try { meta = latest?.meta ? JSON.parse(latest.meta) : null } catch { /* ignore */ }
    return {
      id: k.id,
      keyword: k.keyword,
      category: k.category,
      source: k.source,
      active: k.active,
      landingUrl: k.landingUrl,
      interest: latest?.interest ?? null,
      interestSource: latest?.source ?? null,
      delta: latest && prev ? latest.interest - prev.interest : 0,
      suggestions: meta?.suggestions ?? [],
      sparkline: snaps.map(s => s.interest),
      lastCheckedAt: latest?.capturedAt ?? null,
      capturePage: page
        ? { id: page.id, slug: page.slug, views: page.views, submissions: page.submissions }
        : null,
    }
  })
  return NextResponse.json(items)
}

// POST { keyword, category? } → track one keyword.
// POST { seed: true } → load the demat/trading seed pack.
export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await req.json()

    if (b.seed) {
      let created = 0
      for (const s of SEED_KEYWORDS) {
        const r = await prisma.trackedKeyword.upsert({
          where: { workspaceId_keyword: { workspaceId, keyword: s.keyword } },
          update: { active: true },
          create: { workspaceId, keyword: s.keyword, category: s.category, source: 'seed' },
        })
        if (r.createdAt.getTime() > Date.now() - 5000) created++
      }
      return NextResponse.json({ ok: true, created, total: SEED_KEYWORDS.length })
    }

    const keyword = String(b.keyword ?? '').trim().toLowerCase()
    if (!keyword) return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
    const item = await prisma.trackedKeyword.upsert({
      where: { workspaceId_keyword: { workspaceId, keyword } },
      update: { active: true },
      create: {
        workspaceId,
        keyword,
        category: b.category?.trim() || 'capital-markets',
        source: b.source === 'trending' ? 'trending' : 'manual',
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
