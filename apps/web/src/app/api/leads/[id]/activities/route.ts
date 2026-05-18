import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const lead = await prisma.lead.findFirst({ where: { id, workspaceId } })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const activities = await prisma.leadActivity.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(activities.map(a => ({ ...a, metadata: JSON.parse(a.metadata || '{}') })))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const lead = await prisma.lead.findFirst({ where: { id, workspaceId } })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { type, note, metadata } = await req.json()
    const activity = await prisma.leadActivity.create({
      data: {
        leadId: id,
        type,
        note,
        metadata: JSON.stringify(metadata ?? {}),
      },
    })

    return NextResponse.json({ ...activity, metadata: JSON.parse(activity.metadata) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
