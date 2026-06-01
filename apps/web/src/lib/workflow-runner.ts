import { prisma } from '@/lib/db'
import { publishRunJob, RunJobData } from '@/lib/queue'

export async function runWorkflow(workflowId: string, workspaceId: string, executionId: string): Promise<void> {
  try {
    const workflow = await prisma.workflowDefinition.findFirst({ where: { id: workflowId, workspaceId } })
    if (!workflow) throw new Error('Workflow not found')

    const nodes: any[] = JSON.parse((workflow.nodes as string) || '[]')
    const edges: any[] = JSON.parse((workflow.edges as string) || '[]')

    const inDegree: Record<string, number> = {}
    const children: Record<string, string[]> = {}
    for (const node of nodes) {
      inDegree[node.id] = 0
      children[node.id] = []
    }
    for (const edge of edges) {
      inDegree[edge.target] = (inDegree[edge.target] ?? 0) + 1
      children[edge.source] = [...(children[edge.source] ?? []), edge.target]
    }

    const bfsQueue: string[] = nodes.filter(n => (inDegree[n.id] ?? 0) === 0).map(n => n.id)
    const order: string[] = []
    while (bfsQueue.length > 0) {
      const nodeId = bfsQueue.shift()!
      order.push(nodeId)
      for (const child of children[nodeId] ?? []) {
        inDegree[child] = (inDegree[child] ?? 1) - 1
        if (inDegree[child] === 0) bfsQueue.push(child)
      }
    }

    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
    const execution = await prisma.workflowExecution.findUnique({ where: { id: executionId } })
    const nodeStates: Record<string, any> = execution?.nodeStates
      ? JSON.parse(execution.nodeStates as string)
      : {}

    for (const nodeId of order) {
      const node = nodeMap[nodeId]
      if (!node) continue

      nodeStates[nodeId] = { ...nodeStates[nodeId], status: 'running', startedAt: new Date().toISOString() }
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: { nodeStates: JSON.stringify(nodeStates) },
      })

      if (node.data?.actorId) {
        const run = await prisma.run.create({
          data: {
            workspaceId,
            actorId: node.data.actorId,
            input: JSON.stringify(node.data?.input ?? {}),
            status: 'QUEUED',
          },
        })
        const jobData: RunJobData = {
          runId: run.id,
          workspaceId,
          actorId: node.data.actorId,
          imageName: `tudumm/actor-${node.data.actorId}:latest`,
          input: node.data?.input ?? {},
        }
        await publishRunJob(jobData).catch(() => {})
        nodeStates[nodeId].runId = run.id
        await new Promise(r => setTimeout(r, 2000))
      } else {
        await new Promise(r => setTimeout(r, 1000))
      }

      nodeStates[nodeId] = { ...nodeStates[nodeId], status: 'completed', finishedAt: new Date().toISOString() }
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: { nodeStates: JSON.stringify(nodeStates) },
      })
    }

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'COMPLETED', nodeStates: JSON.stringify(nodeStates), finishedAt: new Date() },
    })

    await prisma.workflowDefinition.update({
      where: { id: workflowId },
      data: { totalRuns: { increment: 1 }, lastRunAt: new Date() },
    })
  } catch (e: any) {
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'FAILED', errorMessage: e.message, finishedAt: new Date() },
    }).catch(() => {})
  }
}
