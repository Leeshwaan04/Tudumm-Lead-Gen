import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { encryptCookie } from '@/lib/cookie-cipher'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
          },
        },
      },
    },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  // Never return the encrypted proxy secret — just whether one is configured.
  const { proxyUrl, ...safe } = workspace as any
  return NextResponse.json({ ...safe, hasProxy: !!proxyUrl })
}

// PATCH /api/workspace — set or clear the bring-your-own proxy (stored encrypted).
export async function PATCH(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!('proxyUrl' in body)) {
    return NextResponse.json({ error: 'proxyUrl is required (empty string to clear)' }, { status: 400 })
  }
  const raw = String(body.proxyUrl || '').trim()
  if (raw && !/^(https?|socks5):\/\/.+/i.test(raw)) {
    return NextResponse.json({ error: 'Proxy must look like http://user:pass@host:port' }, { status: 400 })
  }
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { proxyUrl: raw ? encryptCookie(raw) : null },
  })
  return NextResponse.json({ ok: true, hasProxy: !!raw })
}
