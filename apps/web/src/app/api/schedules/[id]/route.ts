import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { nextRunAt } from '@/lib/cron'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const schedule = await prisma.schedule.findFirst({
      where: { id, workspaceId },
      include: { actor: true },
    })
    if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ...schedule, input: JSON.parse(schedule.input || '{}') })
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
    const { name, cronExpr, status, input, timezone } = body

    const data: any = {}
    if (name !== undefined) data.name = name
    if (cronExpr !== undefined) data.cronExpr = cronExpr
    if (status !== undefined) data.status = status
    if (timezone !== undefined) data.timezone = timezone
    if (input !== undefined) data.input = typeof input === 'string' ? input : JSON.stringify(input)

    // Recompute next run when timing changes. (Resume with no cronExpr in body is
    // handled by the scheduler, which backfills nextRunAt for ACTIVE schedules.)
    if (cronExpr !== undefined) {
      data.nextRunAt = nextRunAt(cronExpr, timezone ?? 'UTC')
    }
    if (status !== undefined && status !== 'ACTIVE') {
      data.nextRunAt = null // paused/archived schedules don't fire
    }

    const result = await prisma.schedule.updateMany({ where: { id, workspaceId }, data })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.schedule.findUnique({ where: { id }, include: { actor: true } })
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...updated, input: JSON.parse(updated.input || '{}') })
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
    const result = await prisma.schedule.deleteMany({ where: { id, workspaceId } })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
