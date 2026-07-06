import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'page'
}

// POST — spin up a Tudumm capture page pre-filled for this keyword and link it.
// The page converts searchers of the keyword into consented B2C leads.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const kw = await prisma.trackedKeyword.findFirst({ where: { id, workspaceId } })
  if (!kw) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (kw.capturePageId) {
    const existing = await prisma.capturePage.findUnique({ where: { id: kw.capturePageId } })
    if (existing) return NextResponse.json(existing)
  }

  try {
    // Keyword-specific lead list so nurture sequences can target by intent.
    const listName = `Keyword — ${kw.keyword}`
    const list =
      (await prisma.leadList.findFirst({ where: { workspaceId, name: listName } })) ??
      (await prisma.leadList.create({ data: { workspaceId, name: listName } }))

    const base = slugify(kw.keyword)
    let slug = base
    for (let i = 0; await prisma.capturePage.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
      if (i > 5) break
    }

    const title = `Keyword: ${kw.keyword}`
    const kwTitle = kw.keyword.replace(/\b\w/g, c => c.toUpperCase())
    const page = await prisma.capturePage.create({
      data: {
        workspaceId,
        slug,
        title,
        headline: `${kwTitle} — Start with a free Demat & Trading account`,
        subheadline: 'Everything you searched for, plus a zero-hassle account opening in minutes.',
        leadMagnet: `Free guide: ${kwTitle} — step-by-step for Indian investors.`,
        ctaText: 'Get the Free Guide',
        listId: list.id,
      },
    })

    await prisma.trackedKeyword.update({ where: { id: kw.id }, data: { capturePageId: page.id } })
    return NextResponse.json(page, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
