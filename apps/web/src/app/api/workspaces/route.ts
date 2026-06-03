import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// GET /api/workspaces — list every workspace the current user belongs to.
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json(
    memberships.map((m) => ({ ...m.workspace, role: m.role }))
  )
}

// POST /api/workspaces — create a new workspace owned by the current user.
export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const trimmed = name.trim().slice(0, 80)

  // Unique slug from name + short random suffix
  const base = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'workspace'
  const slug = `${base}-${Math.random().toString(36).slice(2, 8)}`

  const workspace = await prisma.workspace.create({
    data: {
      name: trimmed,
      slug,
      members: { create: { userId, role: 'OWNER' } },
    },
  })

  return NextResponse.json(workspace, { status: 201 })
}
