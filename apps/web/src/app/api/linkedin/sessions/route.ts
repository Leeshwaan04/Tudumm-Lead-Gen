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
    return NextResponse.json(sessions)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { alias, email, sessionCookie, dailyLimit } = await req.json()
    const created = await prisma.linkedInSession.create({
      data: {
        workspaceId,
        alias,
        email,
        sessionCookie,
        dailyLimit: dailyLimit ?? 100,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
