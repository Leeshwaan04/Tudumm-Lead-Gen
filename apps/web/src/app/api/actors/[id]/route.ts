import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const actor = await prisma.actor.findFirst({
      where: { id, workspaceId },
      include: {
        runs: { orderBy: { createdAt: 'desc' }, take: 5 },
        inputSchema: true,
        _count: { select: { runs: true } },
      },
    })
    if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      ...actor,
      categories: JSON.parse(actor.categories || '[]'),
      tags: JSON.parse(actor.tags || '[]'),
      inputSchema: actor.inputSchema ? {
        ...actor.inputSchema,
        schema: JSON.parse(actor.inputSchema.schema || '{}'),
        uiSchema: JSON.parse(actor.inputSchema.uiSchema || '{}'),
      } : null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { name, description, isPublic, status, categories, tags } = body

    const data: any = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (isPublic !== undefined) data.isPublic = isPublic
    if (status !== undefined) data.status = status
    if (categories !== undefined) data.categories = Array.isArray(categories) ? JSON.stringify(categories) : categories
    if (tags !== undefined) data.tags = Array.isArray(tags) ? JSON.stringify(tags) : tags

    const result = await prisma.actor.updateMany({ where: { id, workspaceId }, data })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.actor.findUnique({ where: { id } })
    return NextResponse.json({
      ...updated,
      categories: JSON.parse((updated as any).categories || '[]'),
      tags: JSON.parse((updated as any).tags || '[]'),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const result = await prisma.actor.deleteMany({ where: { id, workspaceId } })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
