import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const logs = await prisma.auditLog.findMany({
      where: { action: 'password.reset_token' },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const entry = logs.find((log: { id: string; userId: string; metadata: unknown }) => {
      try {
        const meta = JSON.parse(log.metadata as string)
        return meta.token === token && meta.expiresAt > Date.now() && !meta.used
      } catch {
        return false
      }
    })

    if (!entry) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash },
    })

    await prisma.auditLog.update({
      where: { id: entry.id },
      data: { metadata: JSON.stringify({ used: true }) },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
