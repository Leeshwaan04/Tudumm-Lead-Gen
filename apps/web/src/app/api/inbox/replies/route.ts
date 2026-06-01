import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch sequence leads that have replied — activities with type 'reply' or status 'REPLIED'
  const [repliedActivities, repliedLeads] = await Promise.all([
    prisma.leadActivity.findMany({
      where: {
        type: 'reply',
        lead: { workspaceId },
      },
      include: {
        lead: {
          select: {
            id: true, fullName: true, email: true, linkedinUrl: true,
            sequences: {
              include: { sequence: { select: { id: true, name: true, platform: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.sequenceLead.findMany({
      where: {
        status: 'REPLIED',
        sequence: { workspaceId },
      },
      include: {
        lead: { select: { id: true, fullName: true, email: true, linkedinUrl: true } },
        sequence: { select: { id: true, name: true, platform: true } },
      },
      orderBy: { lastStepAt: 'desc' },
      take: 100,
    }),
  ])

  // Merge both sources, deduplicate by leadId
  const seen = new Set<string>()
  const replies: any[] = []

  for (const a of repliedActivities) {
    const key = `${a.leadId}-activity`
    if (seen.has(key)) continue
    seen.add(key)
    const seqLead = a.lead.sequences[0]
    replies.push({
      id: a.id,
      leadId: a.leadId,
      leadName: a.lead.fullName,
      leadEmail: a.lead.email,
      leadLinkedin: a.lead.linkedinUrl,
      sequenceName: seqLead?.sequence.name ?? 'Unknown Sequence',
      sequenceId: seqLead?.sequence.id ?? '',
      platform: seqLead?.sequence.platform ?? 'email',
      stepIndex: 0,
      repliedAt: a.createdAt.toISOString(),
      note: a.note,
    })
  }

  for (const sl of repliedLeads) {
    const key = `${sl.leadId}-${sl.sequenceId}`
    if (seen.has(key)) continue
    seen.add(key)
    replies.push({
      id: sl.id,
      leadId: sl.leadId,
      leadName: sl.lead.fullName,
      leadEmail: sl.lead.email,
      leadLinkedin: sl.lead.linkedinUrl,
      sequenceName: sl.sequence.name,
      sequenceId: sl.sequence.id,
      platform: sl.sequence.platform,
      stepIndex: sl.currentStep,
      repliedAt: (sl.lastStepAt ?? new Date()).toISOString(),
      note: null,
    })
  }

  return NextResponse.json(replies)
}
