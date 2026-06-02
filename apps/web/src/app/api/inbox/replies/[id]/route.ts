import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// PATCH /api/inbox/replies/[id]
// Body: { action: 'handled' | 'note', note?: string, leadId?: string }
// id can be a SequenceLead id or LeadActivity id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action, note, leadId } = body

  if (action === 'handled') {
    // Mark SequenceLead as REPLIED (if it's a sequenceLead id)
    const sl = await prisma.sequenceLead.findFirst({
      where: { id, sequence: { workspaceId } },
    })
    if (sl) {
      await prisma.sequenceLead.update({
        where: { id },
        data: { status: 'REPLIED', lastStepAt: new Date() },
      })
    }
    // Log an activity for audit trail
    if (leadId) {
      await prisma.leadActivity.create({
        data: {
          leadId,
          type: 'handled',
          note: 'Marked as handled from Inbox',
        },
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'note' && note && leadId) {
    const activity = await prisma.leadActivity.create({
      data: {
        leadId,
        type: 'reply',
        note,
        metadata: JSON.stringify({ source: 'inbox_manual', workspaceId }),
      },
    })
    return NextResponse.json(activity)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
