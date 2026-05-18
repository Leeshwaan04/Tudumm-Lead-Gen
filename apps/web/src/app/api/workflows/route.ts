import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workflows = await prisma.workflowDefinition.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(workflows.map(w => ({
      ...w,
      nodes: JSON.parse(w.nodes || '[]'),
      edges: JSON.parse(w.edges || '[]'),
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

    const { name, description, nodes, edges } = await req.json()
    const workflow = await prisma.workflowDefinition.create({
      data: {
        workspaceId,
        name,
        description,
        nodes: JSON.stringify(nodes ?? []),
        edges: JSON.stringify(edges ?? []),
      },
    })

    return NextResponse.json({
      ...workflow,
      nodes: JSON.parse(workflow.nodes || '[]'),
      edges: JSON.parse(workflow.edges || '[]'),
    }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
