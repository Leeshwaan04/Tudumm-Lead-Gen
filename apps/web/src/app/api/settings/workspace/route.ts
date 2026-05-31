import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMember, requireOwner } from '@/lib/authz'

export async function GET() {
  const ctx = await requireMember()
  if (ctx instanceof NextResponse) return ctx

  const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(workspace)
}

export async function PATCH(req: Request) {
  const ctx = await requireOwner()
  if (ctx instanceof NextResponse) return ctx
  const workspaceId = ctx.workspaceId

  const { name, slug } = await req.json()

  const data: any = {}
  if (name !== undefined) data.name = name
  if (slug !== undefined) data.slug = slug

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const updated = await prisma.workspace.update({ where: { id: workspaceId }, data })
    return NextResponse.json(updated)
  } catch (err: any) {
    // Handle unique constraint on slug
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
    }
    throw err
  }
}
