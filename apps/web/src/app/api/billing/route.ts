import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [workspace, transactions] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      prisma.creditTransaction.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      plan: workspace.plan,
      creditBalance: workspace.creditBalance,
      execHoursUsed: workspace.execHoursUsed,
      execHoursLimit: workspace.execHoursLimit,
      transactions,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
