import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { safeParseSteps } from '@/lib/sequence-steps'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const sequence = await prisma.sequence.findFirst({
      where: { id, workspaceId },
      include: {
        leads: {
          include: {
            lead: {
              select: { id: true, fullName: true, email: true, company: true, icpScore: true },
            },
          },
        },
      },
    })
    if (!sequence) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ...sequence, steps: safeParseSteps(sequence.steps) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const data: any = { ...body }
    if (body.steps !== undefined) {
      data.steps = JSON.stringify(body.steps)
    }

    const result = await prisma.sequence.updateMany({ where: { id, workspaceId }, data })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.sequence.findUnique({ where: { id } })
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...updated, steps: safeParseSteps(updated.steps) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const result = await prisma.sequence.deleteMany({ where: { id, workspaceId } })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
