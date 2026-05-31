import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMember } from '@/lib/authz'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireMember()
    if (ctx instanceof NextResponse) return ctx

    const { id } = await params
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
      include: { activities: { orderBy: { createdAt: 'desc' } } },
    })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(lead)
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireMember()
    if (ctx instanceof NextResponse) return ctx

    const { id } = await params
    const body = await req.json()

    const allowedFields = ['fullName', 'firstName', 'lastName', 'title', 'company', 'email', 'linkedinUrl', 'twitterUrl', 'icpScore', 'source', 'listId', 'phone', 'location']
    const data: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Normalize email to lowercase for consistency with import path
        data[field] = field === 'email' && typeof body[field] === 'string' ? body[field].toLowerCase() : body[field]
      }
    }

    const lead = await prisma.lead.updateMany({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
      data,
    })
    if (lead.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.lead.findUnique({ where: { id } })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireMember()
    if (ctx instanceof NextResponse) return ctx

    const { id } = await params
    // Soft delete — sets deletedAt instead of removing row. Restorable.
    const result = await prisma.lead.updateMany({
      where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
