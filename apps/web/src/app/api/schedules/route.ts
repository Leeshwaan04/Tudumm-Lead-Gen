import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

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

  const actor = await prisma.actor.findFirst({ where: { id: actorId } })
  if (!actor) return NextResponse.json({ error: 'Actor not found' }, { status: 404 })

  const schedule = await prisma.schedule.create({
    data: { name, actorId, cronExpr, workspaceId, input: JSON.stringify(body.input ?? {}), timezone: body.timezone ?? 'UTC' },
  })
  return NextResponse.json(schedule, { status: 201 })
}
