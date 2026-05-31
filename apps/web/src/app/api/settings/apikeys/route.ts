import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMember, requireAdmin } from '@/lib/authz'
import crypto from 'crypto'

export async function GET() {
  const ctx = await requireMember()
  if (ctx instanceof NextResponse) return ctx

  const keys = await prisma.apiKey.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, name: true, keyPrefix: true, scopes: true, lastUsedAt: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const parsed = keys.map(k => ({ ...k, scopes: JSON.parse(k.scopes || '[]') }))
  return NextResponse.json(parsed)
}

export async function POST(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx

  const { name, scopes } = await req.json()
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  const raw = `tdk_${crypto.randomBytes(16).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(raw).digest('hex')
  const keyPrefix = raw.slice(0, 12)

  const key = await prisma.apiKey.create({
    data: { workspaceId: ctx.workspaceId, name, keyHash, keyPrefix, scopes: JSON.stringify(scopes ?? ['read']) },
  })
  return NextResponse.json({ ...key, scopes: JSON.parse(key.scopes), raw }, { status: 201 })
}

export async function DELETE(req: Request) {
  const ctx = await requireAdmin()
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.apiKey.deleteMany({ where: { id, workspaceId: ctx.workspaceId } })
  return NextResponse.json({ ok: true })
}
