import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const run = await prisma.run.findFirst({
      where: { id, workspaceId },
      include: { logs: { orderBy: { timestamp: 'asc' } }, actor: true },
    })
    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(run)
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const allowedFields = ['status', 'output', 'exitCode', 'errorMessage', 'finishedAt', 'durationMs']
    const data: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field]
    }

    // Abort shorthand: if status is CANCELLED, stamp finishedAt
    if (body.status === 'CANCELLED') {
      if (!body.finishedAt) data.finishedAt = new Date()
      if (!body.errorMessage) data.errorMessage = 'Cancelled by user'
    }

    const run = await prisma.run.updateMany({ where: { id, workspaceId }, data })
    if (run.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.run.findUnique({ where: { id }, include: { actor: true, logs: { orderBy: { timestamp: 'asc' } } } })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
