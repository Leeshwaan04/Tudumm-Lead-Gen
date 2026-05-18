import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sequences = await prisma.sequence.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(sequences)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, platform, steps } = await req.json()
  if (!name || !platform) return NextResponse.json({ error: 'name and platform are required' }, { status: 400 })

  const sequence = await prisma.sequence.create({
    data: {
      workspaceId,
      name,
      platform,
      steps: JSON.stringify(steps ?? []),
    },
  })

  return NextResponse.json({ ...sequence, steps: JSON.parse(sequence.steps) }, { status: 201 })
}
