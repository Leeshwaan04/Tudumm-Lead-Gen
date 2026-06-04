import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { runWorkflow } from '@/lib/workflow-runner'
import { guardExpensive, getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // A workflow can fan out into many scrapes/enriches — guard it too.
    const limited = guardExpensive('workflow', getClientIp(req), workspaceId, { perMinute: 10, perDay: 200 })
    if (limited) return NextResponse.json({ error: limited }, { status: 429 })

    const { id } = await params
    const workflow = await prisma.workflowDefinition.findFirst({ where: { id, workspaceId } })
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Defensive parse: heals legacy double-encoded rows (parse yields a string).
    let nodes: any = JSON.parse((workflow.nodes as string) || '[]')
    if (typeof nodes === 'string') nodes = JSON.parse(nodes)
    if (!Array.isArray(nodes)) nodes = []
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
