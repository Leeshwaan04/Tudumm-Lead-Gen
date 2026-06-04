import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encryptCookie } from '@/lib/cookie-cipher'
import { requireMember, requireAdmin } from '@/lib/authz'

const VALID_PLATFORMS = ['TWITTER', 'INSTAGRAM']

export async function GET(req: Request) {
  try {
    const ctx = await requireMember()
    if (ctx instanceof NextResponse) return ctx

    const { searchParams } = new URL(req.url)
    const platform = searchParams.get('platform')?.toUpperCase()

    const where: any = { workspaceId: ctx.workspaceId }
    if (platform && VALID_PLATFORMS.includes(platform)) where.platform = platform

    const sessions = await prisma.socialSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    const sanitized = sessions.map(({ sessionCookie, ...s }) => ({ ...s, cookieSet: !!sessionCookie }))
    return NextResponse.json(sanitized)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAdmin()
    if (ctx instanceof NextResponse) return ctx

    const body = await req.json()
    const platform = String(body.platform ?? '').toUpperCase()
    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` }, { status: 400 })
    }

    const alias = body.alias ?? 'Unnamed'
    const email = body.email ?? `${platform.toLowerCase()}-${Date.now()}@placeholder.com`
    const rawCookie = body.sessionCookie ?? body.cookie ?? ''
    const sessionCookie = rawCookie ? encryptCookie(rawCookie) : ''

    const created = await prisma.socialSession.create({
      data: {
        workspaceId: ctx.workspaceId,
        platform,
        alias,
        email,
        sessionCookie,
        dailyLimit: body.dailyLimit ?? 100,
      },
    })
    const { sessionCookie: _c, ...out } = created
    return NextResponse.json({ ...out, cookieSet: !!rawCookie }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
