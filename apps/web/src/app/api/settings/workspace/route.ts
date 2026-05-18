import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(workspace)
}

export async function PATCH(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
