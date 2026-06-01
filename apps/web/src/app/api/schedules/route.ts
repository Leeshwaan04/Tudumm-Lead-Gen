import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { nextRunAt } from '@/lib/cron'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schedules = await prisma.schedule.findMany({
    where: { workspaceId },
    include: { actor: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(schedules)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, actorId, cronExpr } = body
  if (!name || !actorId || !cronExpr) {
    return NextResponse.json({ error: 'name, actorId, and cronExpr are required' }, { status: 400 })
  }

  // Ensure actor exists in this workspace; if using store slug, auto-create a local actor record
  let actor = await prisma.actor.findFirst({ where: { id: actorId } })
  if (!actor) {
    const userId = session?.user?.id!
    actor = await prisma.actor.create({
      data: { workspaceId, authorId: userId, name: actorId, slug: actorId + '-' + Date.now(), description: '', status: 'DRAFT' },
    })
  }

  const timezone = body.timezone ?? 'UTC'
  const schedule = await prisma.schedule.create({
    data: {
      name, actorId: actor.id, cronExpr, workspaceId,
      input: JSON.stringify(body.input ?? {}),
      timezone,
      nextRunAt: nextRunAt(cronExpr, timezone),
    },
  })
  return NextResponse.json(schedule, { status: 201 })
}
