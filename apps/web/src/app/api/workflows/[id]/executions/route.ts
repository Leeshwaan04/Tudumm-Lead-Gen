import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Verify the workflow belongs to this workspace
    const workflow = await prisma.workflowDefinition.findFirst({ where: { id, workspaceId } })
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const executions = await prisma.workflowExecution.findMany({
      where: { workflowId: id },
      orderBy: { startedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json(
      executions.map(e => ({
        ...e,
        nodeStates: JSON.parse(e.nodeStates || '{}'),
        itemsScraped: Object.keys(JSON.parse(e.nodeStates || '{}')).length,
      })),
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
