import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const playbooks = await prisma.playbook.findMany({
      where: {
        OR: [
          { isPublic: true },
          { workspaceId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(playbooks.map(p => ({
      ...p,
      stages: JSON.parse(p.stages || '[]'),
    })))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, description, category, platform, stages } = body
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const playbook = await prisma.playbook.create({
      data: {
        workspaceId,
        name,
        description: description ?? null,
        category: category ?? 'general',
        platform: platform ?? 'multi',
        stages: JSON.stringify(stages ?? []),
        isPublic: false,
      },
    })
    return NextResponse.json({ ...playbook, stages: JSON.parse(playbook.stages) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
