import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { pingIndexNow } from '@/lib/indexnow'

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'page'
}

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const pages = await prisma.capturePage.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(pages)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const b = await req.json()
    if (!b.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    // Unique slug
    const base = slugify(b.slug || b.title)
    let slug = base
    for (let i = 0; await prisma.capturePage.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
      if (i > 5) break
    }

    // Optional: ensure a B2C category list exists to file leads under
    let listId: string | null = b.listId ?? null
    if (!listId) {
      const existing = await prisma.leadList.findFirst({ where: { workspaceId, name: 'B2C — Captured Leads' } })
      listId = existing?.id ?? (await prisma.leadList.create({ data: { workspaceId, name: 'B2C — Captured Leads' } })).id
    }

    const page = await prisma.capturePage.create({
      data: {
        workspaceId,
        slug,
        title: b.title.trim(),
        headline: b.headline?.trim() || undefined,
        subheadline: b.subheadline?.trim() || undefined,
        leadMagnet: b.leadMagnet?.trim() || undefined,
        ctaText: b.ctaText?.trim() || undefined,
        collectName: b.collectName ?? true,
        collectEmail: b.collectEmail ?? true,
        collectPhone: b.collectPhone ?? true,
        consentText: b.consentText?.trim() || undefined,
        listId,
      },
    })
    pingIndexNow([`/p/${page.slug}`]) // new public page → search engines within minutes
    return NextResponse.json(page, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
