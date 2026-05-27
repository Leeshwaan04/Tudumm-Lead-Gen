import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const datasets = await prisma.dataset.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: { run: { select: { actor: { select: { name: true } } } } },
  })
  return NextResponse.json(datasets)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, runId } = body
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const dataset = await prisma.dataset.create({
    data: {
      workspaceId,
      name,
      runId: runId ?? null,
      s3Key: `datasets/${workspaceId}/${Date.now()}.json`,
    },
  })
  return NextResponse.json(dataset, { status: 201 })
}
