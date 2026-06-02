import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { publishSequenceJob } from '@/lib/queues/sequence-queue'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const now = new Date()
    
    // Find unique sequences that have ready sequence_leads
    const readySequences = await prisma.sequenceLead.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        OR: [
          { nextStepAt: null },
          { nextStepAt: { lte: now } }
        ]
      },
      select: {
        sequenceId: true,
        sequence: { select: { workspaceId: true } }
      },
      distinct: ['sequenceId']
    })
    
    for (const item of readySequences) {
      await publishSequenceJob({
        sequenceId: item.sequenceId,
        workspaceId: item.sequence.workspaceId
      })
    }
    
    return NextResponse.json({ success: true, count: readySequences.length })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
