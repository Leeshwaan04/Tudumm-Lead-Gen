import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { sessionCookie, status, dailyLimit, alias } = body

    const data: any = {}
    if (sessionCookie !== undefined) data.sessionCookie = sessionCookie
    if (status !== undefined) data.status = status
    if (dailyLimit !== undefined) data.dailyLimit = dailyLimit
    if (alias !== undefined) data.alias = alias

    const result = await prisma.linkedInSession.updateMany({ where: { id, workspaceId }, data })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.linkedInSession.findUnique({ where: { id } })
    return NextResponse.json(updated)
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
    const result = await prisma.linkedInSession.deleteMany({ where: { id, workspaceId } })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
