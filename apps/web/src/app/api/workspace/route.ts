import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: { include: { user: true } } },
  })
  return NextResponse.json(workspace)
}
