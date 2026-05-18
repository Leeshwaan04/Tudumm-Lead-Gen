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
