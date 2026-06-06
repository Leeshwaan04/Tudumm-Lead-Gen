import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const b = await req.json()
    const data: Record<string, unknown> = {}
    for (const k of ['title', 'headline', 'subheadline', 'leadMagnet', 'ctaText', 'consentText'] as const) {
      if (typeof b[k] === 'string') data[k] = b[k]
    }
    for (const k of ['collectName', 'collectEmail', 'collectPhone', 'published'] as const) {
      if (typeof b[k] === 'boolean') data[k] = b[k]
    }
    await prisma.capturePage.updateMany({ where: { id, workspaceId }, data })
    const updated = await prisma.capturePage.findFirst({ where: { id, workspaceId } })
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.capturePage.deleteMany({ where: { id, workspaceId } })
  return NextResponse.json({ ok: true })
}
