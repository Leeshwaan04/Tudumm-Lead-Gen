import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function parseWorkflow(w: any) {
  return {
    ...w,
    nodes: JSON.parse(w.nodes || '[]'),
    edges: JSON.parse(w.edges || '[]'),
    executions: w.executions?.map((e: any) => ({
      ...e,
      nodeStates: JSON.parse(e.nodeStates || '{}'),
    })),
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const workflow = await prisma.workflowDefinition.findFirst({
      where: { id, workspaceId },
      include: { executions: { orderBy: { startedAt: 'desc' }, take: 10 } },
    })
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(parseWorkflow(workflow))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { name, nodes, edges, status } = body

    const data: any = {}
    if (name !== undefined) data.name = name
    if (status !== undefined) data.status = status
    if (nodes !== undefined) data.nodes = Array.isArray(nodes) ? JSON.stringify(nodes) : nodes
    if (edges !== undefined) data.edges = Array.isArray(edges) ? JSON.stringify(edges) : edges

    const result = await prisma.workflowDefinition.updateMany({ where: { id, workspaceId }, data })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.workflowDefinition.findUnique({ where: { id } })
    return NextResponse.json(parseWorkflow(updated))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const result = await prisma.workflowDefinition.deleteMany({ where: { id, workspaceId } })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
