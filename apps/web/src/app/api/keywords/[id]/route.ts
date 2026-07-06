import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// PATCH { active?, landingUrl?, category? } — update a tracked keyword.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.trackedKeyword.findFirst({ where: { id, workspaceId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const b = await req.json()
    const updated = await prisma.trackedKeyword.update({
      where: { id },
      data: {
        ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
        ...(typeof b.landingUrl === 'string' ? { landingUrl: b.landingUrl.trim() || null } : {}),
        ...(typeof b.category === 'string' && b.category.trim() ? { category: b.category.trim() } : {}),
      },
    })
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

  const existing = await prisma.trackedKeyword.findFirst({ where: { id, workspaceId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.trackedKeyword.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
