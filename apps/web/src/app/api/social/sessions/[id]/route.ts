import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encryptCookie, isEncrypted } from '@/lib/cookie-cipher'
import { requireMember, requireAdmin } from '@/lib/authz'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireMember()
    if (ctx instanceof NextResponse) return ctx
    const { id } = await params
    const record = await prisma.socialSession.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { sessionCookie, ...out } = record
    return NextResponse.json({ ...out, cookieSet: !!sessionCookie })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmin()
    if (ctx instanceof NextResponse) return ctx
    const { id } = await params
    const body = await req.json()
    const { sessionCookie, status, dailyLimit, alias } = body

    const data: any = {}
    if (sessionCookie !== undefined && sessionCookie !== '') {
      data.sessionCookie = isEncrypted(sessionCookie) ? sessionCookie : encryptCookie(sessionCookie)
    }
    if (status !== undefined) data.status = status
    if (dailyLimit !== undefined) data.dailyLimit = dailyLimit
    if (alias !== undefined) data.alias = alias

    const result = await prisma.socialSession.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.socialSession.findUnique({ where: { id } })
    const { sessionCookie: _c, ...out } = updated!
    return NextResponse.json({ ...out, cookieSet: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmin()
    if (ctx instanceof NextResponse) return ctx
    const { id } = await params
    const result = await prisma.socialSession.deleteMany({ where: { id, workspaceId: ctx.workspaceId } })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
