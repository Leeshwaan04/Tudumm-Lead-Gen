import { handlers } from '@/auth'
import { NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const { GET } = handlers

export async function POST(req: Request) {
  // Apply rate limiting only to the credentials sign-in action
  const url = new URL(req.url)
  if (url.pathname.endsWith('/callback/credentials')) {
    const ip = getClientIp(req)
    if (!rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 })
    }
  }
  return (handlers.POST as any)(req)
}
