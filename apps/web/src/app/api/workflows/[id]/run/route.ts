import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const workflow = await prisma.workflowDefinition.findFirst({ where: { id, workspaceId } })
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nodes: any[] = JSON.parse(workflow.nodes || '[]')

    // Build initial nodeStates
    const nodeStates: Record<string, any> = {}
    nodes.forEach((node: any) => {
      nodeStates[node.id] = { status: 'PENDING' }
    })

    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: id,
        workspaceId,
        status: 'RUNNING',
        nodeStates: JSON.stringify(nodeStates),
      },
    })

    // Simulate execution: mark each node SUCCEEDED
    nodes.forEach((node: any) => {
      nodeStates[node.id] = { status: 'SUCCEEDED', completedAt: new Date().toISOString() }
    })

    const finishedExecution = await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'SUCCEEDED',
        nodeStates: JSON.stringify(nodeStates),
        finishedAt: new Date(),
      },
    })

    await prisma.workflowDefinition.update({
      where: { id },
      data: { totalRuns: { increment: 1 }, lastRunAt: new Date() },
    })

    return NextResponse.json({
      ...finishedExecution,
      nodeStates: JSON.parse(finishedExecution.nodeStates || '{}'),
    }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
