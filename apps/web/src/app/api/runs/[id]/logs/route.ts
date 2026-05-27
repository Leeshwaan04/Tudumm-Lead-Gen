import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const run = await prisma.run.findFirst({ where: { id, workspaceId } })
    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const since = searchParams.get('since')
    let sinceDate: Date | undefined
    if (since) {
      sinceDate = new Date(since)
      if (isNaN(sinceDate.getTime())) {
        return NextResponse.json({ error: 'Invalid since parameter — must be ISO 8601 date' }, { status: 400 })
      }
    }

    const logs = await prisma.runLog.findMany({
      where: {
        runId: id,
        ...(sinceDate ? { timestamp: { gt: sinceDate } } : {}),
      },
      orderBy: { timestamp: 'asc' },
    })

    return NextResponse.json(logs)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
