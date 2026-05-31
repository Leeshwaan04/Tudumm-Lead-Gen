import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMember } from '@/lib/authz'
import { publishSequenceJob } from '@/lib/queues/sequence-queue'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireMember()
    if (ctx instanceof NextResponse) return ctx
    const { workspaceId } = ctx

    const { id: sequenceId } = await params

    const sequence = await prisma.sequence.findFirst({ where: { id: sequenceId, workspaceId } })
    if (!sequence) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (sequence.status !== 'ACTIVE') return NextResponse.json({ error: 'Sequence is not active' }, { status: 400 })

    await publishSequenceJob({ sequenceId, workspaceId })

    return NextResponse.json({ status: 'QUEUED', message: 'Sequence processing has been queued.' })
  } catch (e: any) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
