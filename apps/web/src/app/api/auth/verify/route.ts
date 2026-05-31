import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/auth/verify?token=xxx — clicked from the verification email
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', req.url))
  }

  // Find the audit log entry containing this token
  const logs = await prisma.auditLog.findMany({
    where: { action: 'email.verify_token' },
    orderBy: { createdAt: 'desc' },
    take: 500, // bounded scan
  })

  const entry = logs.find(l => {
    try {
      const m = JSON.parse(l.metadata)
      return m.token === token && m.expiresAt > Date.now()
    } catch {
      return false
    }
  })

  if (!entry || !entry.userId) {
    return NextResponse.redirect(new URL('/login?error=invalid_or_expired_token', req.url))
  }

  await prisma.user.update({
    where: { id: entry.userId },
    data: { emailVerified: true },
  })

  // Invalidate the token by overwriting metadata
  await prisma.auditLog.update({
    where: { id: entry.id },
    data: { metadata: JSON.stringify({ used: true }) },
  })

  return NextResponse.redirect(new URL('/login?verified=1', req.url))
}
