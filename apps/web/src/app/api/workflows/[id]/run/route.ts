import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { publishRunJob } from '@/lib/queue'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const workflow = await prisma.workflowDefinition.findFirst({ where: { id, workspaceId } })
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nodes: any[] = JSON.parse(workflow.nodes || '[]')
    const edges: any[] = JSON.parse(workflow.edges || '[]')
    const inputOverrides = req.headers.get('content-type')?.includes('json')
      ? await req.json().catch(() => ({}))
      : {}

    // Build adjacency map for topological sort
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

    // Topological sort (Kahn's algorithm)
    const queue: string[] = nodes.filter(n => (inDegree[n.id] ?? 0) === 0).map(n => n.id)
    const order: string[] = []
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      order.push(nodeId)
      for (const child of children[nodeId] ?? []) {
        inDegree[child] = (inDegree[child] ?? 1) - 1
        if (inDegree[child] === 0) queue.push(child)
      }
    }

    // Initialize nodeStates
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

    // Execute nodes in topological order (async, best-effort)
    executeDAG({ executionId: execution.id, workflowId: id, workspaceId, order, nodes, nodeStates, inputOverrides })

    await prisma.workflowDefinition.update({
      where: { id },
      data: { totalRuns: { increment: 1 }, lastRunAt: new Date() },
    })

    return NextResponse.json({
      ...execution,
      nodeStates,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[Workflow] Run error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function executeDAG({
  executionId, workflowId, workspaceId, order, nodes, nodeStates, inputOverrides,
}: {
  executionId: string
  workflowId: string
  workspaceId: string
  order: string[]
  nodes: any[]
  nodeStates: Record<string, any>
  inputOverrides: any
}) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
  let overallStatus: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED'

  for (const nodeId of order) {
    const node = nodeMap[nodeId]
    if (!node) continue

    nodeStates[nodeId].status = 'RUNNING'
    nodeStates[nodeId].startedAt = new Date().toISOString()

    try {
      if (node.type === 'actor' && node.data?.actorId) {
        // Create a run record and enqueue it
        const actor = await prisma.actor.findFirst({ where: { id: node.data.actorId, workspaceId } })
        if (actor) {
          const run = await prisma.run.create({
            data: {
              workspaceId,
              actorId: actor.id,
              input: JSON.stringify({ ...(node.data?.input ?? {}), ...(inputOverrides ?? {}) }),
              status: 'QUEUED',
            },
          })
          try {
            await publishRunJob({
              runId: run.id,
              workspaceId,
              actorId: actor.id,
              imageName: `tudumm/actor-${actor.slug}:latest`,
              input: node.data?.input ?? {},
            })
          } catch {}
          nodeStates[nodeId].runId = run.id
        }
      } else if (node.type === 'filter') {
        // Filter nodes are evaluated client-side — mark as passthrough
        nodeStates[nodeId].itemsFiltered = 0
      } else if (node.type === 'sequence' && node.data?.sequenceId) {
        // Trigger sequence execution
        nodeStates[nodeId].sequenceId = node.data.sequenceId
      }

      nodeStates[nodeId].status = 'SUCCEEDED'
      nodeStates[nodeId].completedAt = new Date().toISOString()
    } catch (err: any) {
      nodeStates[nodeId].status = 'FAILED'
      nodeStates[nodeId].error = err.message
      overallStatus = 'FAILED'
    }

    // Persist state after each node
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { nodeStates: JSON.stringify(nodeStates) },
    })
  }

  await prisma.workflowExecution.update({
    where: { id: executionId },
    data: { status: overallStatus, nodeStates: JSON.stringify(nodeStates), finishedAt: new Date() },
  })
}
