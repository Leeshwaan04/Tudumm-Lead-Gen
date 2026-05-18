import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { workspaceId },
    select: { id: true, name: true, keyPrefix: true, scopes: true, lastUsedAt: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  })
  // parse scopes from JSON string
  const parsed = keys.map(k => ({ ...k, scopes: JSON.parse(k.scopes || '[]') }))
  return NextResponse.json(parsed)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, scopes } = await req.json()
  const raw = `tdk_${crypto.randomBytes(16).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(raw).digest('hex')
  const keyPrefix = raw.slice(0, 12)

  const key = await prisma.apiKey.create({
    data: { workspaceId, name, keyHash, keyPrefix, scopes: JSON.stringify(scopes ?? ['read']) },
  })
  return NextResponse.json({ ...key, scopes: JSON.parse(key.scopes), raw }, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.apiKey.deleteMany({ where: { id, workspaceId } })
  return NextResponse.json({ ok: true })
}
