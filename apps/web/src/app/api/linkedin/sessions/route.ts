import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessions = await prisma.linkedInSession.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    const sanitized = sessions.map(({ sessionCookie, ...s }) => ({ ...s, cookieSet: true }))
    return NextResponse.json(sanitized)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const alias = body.alias ?? body.accountName ?? 'Unnamed'
    const email = body.email ?? body.accountEmail ?? `li-${Date.now()}@placeholder.com`
    const sessionCookie = body.sessionCookie ?? body.cookie ?? ''
    const { dailyLimit } = body
    const created = await prisma.linkedInSession.create({
      data: {
        workspaceId,
        alias,
        email,
        sessionCookie,
        dailyLimit: dailyLimit ?? 100,
      },
    })
    const { sessionCookie: _cookie, ...createdWithout } = created
    return NextResponse.json({ ...createdWithout, cookieSet: true }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
