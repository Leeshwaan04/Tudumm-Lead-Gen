import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const store = searchParams.get('store') === 'true'

  if (store) {
    const actors = await prisma.actor.findMany({
      where: { isPublic: true, status: 'PUBLISHED' },
      orderBy: { totalRuns: 'desc' },
      take: 50,
    })
    return NextResponse.json(actors)
  }

  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Include the workspace's own actors AND public/published store actors, so
  // Quick Run and pickers are populated even for brand-new workspaces.
  const actors = await prisma.actor.findMany({
    where: {
      OR: [
        { workspaceId },
        { isPublic: true, status: 'PUBLISHED' },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(actors)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  const userId = session?.user?.id
  if (!workspaceId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const name = body.name ?? 'Untitled Actor'
  const slug = body.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now()
  const actor = await prisma.actor.create({
    data: {
      workspaceId,
      authorId: userId,
      name,
      slug,
      description: body.description ?? '',
      categories: JSON.stringify(body.categories ?? []),
      tags: JSON.stringify(body.tags ?? []),
      isPublic: body.isPublic ?? false,
      status: body.status ?? 'DRAFT',
    },
  })
  return NextResponse.json(actor, { status: 201 })
}
