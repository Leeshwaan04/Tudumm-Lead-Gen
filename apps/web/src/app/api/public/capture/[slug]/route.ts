import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// PUBLIC — no auth. Returns the page config for rendering, and accepts form
// submissions that become consented B2C leads in the owner's workspace.

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await prisma.capturePage.findUnique({ where: { slug } })
  if (!page || !page.published) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  prisma.capturePage.update({ where: { id: page.id }, data: { views: { increment: 1 } } }).catch(() => {})
  // Only expose presentational fields publicly (never workspaceId/listId).
  return NextResponse.json({
    slug: page.slug, headline: page.headline, subheadline: page.subheadline,
    leadMagnet: page.leadMagnet, ctaText: page.ctaText, consentText: page.consentText,
    collectName: page.collectName, collectEmail: page.collectEmail, collectPhone: page.collectPhone,
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const page = await prisma.capturePage.findUnique({ where: { slug } })
    if (!page || !page.published) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const b = await req.json()
    const email = String(b.email || '').trim().toLowerCase()
    const name = String(b.name || '').trim()
    const phone = String(b.phone || '').trim()
    if (page.collectEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }
    if (!email && !phone) return NextResponse.json({ error: 'Email or phone is required' }, { status: 400 })
    // Consent is mandatory — this is what makes the lead compliant (DPDP/SEBI).
    if (!b.consent) return NextResponse.json({ error: 'Consent is required' }, { status: 400 })

    const [firstName, ...rest] = name.split(' ')
    const consentMeta = JSON.stringify({ consent: true, consentText: page.consentText, consentAt: new Date().toISOString(), capturePage: page.slug })

    // Upsert by (workspace,email) so re-submits update instead of erroring.
    if (email) {
      await prisma.lead.upsert({
        where: { lead_workspace_email_unique: { workspaceId: page.workspaceId, email } },
        create: {
          workspaceId: page.workspaceId, email, emailStatus: 'VERIFIED',
          firstName: firstName || null, lastName: rest.join(' ') || null,
          fullName: name || email, phone: phone || null,
          listId: page.listId, source: 'Landing Page', customFields: consentMeta,
        },
        update: { phone: phone || undefined, fullName: name || undefined, source: 'Landing Page', customFields: consentMeta },
      })
    } else {
      await prisma.lead.create({
        data: {
          workspaceId: page.workspaceId, fullName: name || phone, firstName: firstName || null,
          phone, listId: page.listId, source: 'Landing Page', customFields: consentMeta,
        },
      })
    }
    await prisma.capturePage.update({ where: { id: page.id }, data: { submissions: { increment: 1 } } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
