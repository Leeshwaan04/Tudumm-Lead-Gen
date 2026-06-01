import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { runWorkflow } from '@/lib/workflow-runner'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const workflow = await prisma.workflowDefinition.findFirst({ where: { id, workspaceId } })
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nodes: any[] = JSON.parse((workflow.nodes as string) || '[]')
    const nodeStates: Record<string, any> = {}
    for (const node of nodes) {
      nodeStates[node.id] = { status: 'PENDING', type: node.type, label: node.data?.label }
    }

    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: id,
        workspaceId,
        status: 'RUNNING',
        nodeStates: JSON.stringify(nodeStates),
      },
    })

    runWorkflow(id, workspaceId, execution.id)

    return NextResponse.json({ ...execution, nodeStates }, { status: 201 })
  } catch (e: any) {
    console.error('[Workflow] Run error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
