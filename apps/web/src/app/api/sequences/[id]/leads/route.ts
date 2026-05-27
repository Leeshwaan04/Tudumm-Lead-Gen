import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sequenceId } = await params

  const sequence = await prisma.sequence.findFirst({ where: { id: sequenceId, workspaceId } })
  if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })

  const sequenceLeads = await prisma.sequenceLead.findMany({
    where: { sequenceId },
    include: { lead: true },
    orderBy: { addedAt: 'asc' },
  })

  return NextResponse.json(sequenceLeads)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sequenceId } = await params
  const { leadId } = await req.json()
  if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

  // Verify sequence belongs to workspace
  const sequence = await prisma.sequence.findFirst({ where: { id: sequenceId, workspaceId } })
  if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })

  // Verify lead belongs to workspace
  const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Check for duplicate
  const existing = await prisma.sequenceLead.findUnique({ where: { sequenceId_leadId: { sequenceId, leadId } } })
  if (existing) return NextResponse.json({ error: 'Lead already in sequence' }, { status: 409 })

  const sequenceLead = await prisma.sequenceLead.create({
    data: { sequenceId, leadId },
  })

  await prisma.sequence.update({
    where: { id: sequenceId },
    data: { leadCount: { increment: 1 } },
  })

  return NextResponse.json(sequenceLead, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sequenceId } = await params
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ error: 'leadId query param is required' }, { status: 400 })

  // Verify sequence belongs to workspace
  const sequence = await prisma.sequence.findFirst({ where: { id: sequenceId, workspaceId } })
  if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })

  const result = await prisma.sequenceLead.deleteMany({ where: { sequenceId, leadId } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.sequence.update({
    where: { id: sequenceId },
    data: { leadCount: { decrement: 1 } },
  })

  return NextResponse.json({ ok: true })
}
