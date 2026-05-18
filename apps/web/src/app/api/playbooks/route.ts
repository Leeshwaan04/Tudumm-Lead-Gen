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
