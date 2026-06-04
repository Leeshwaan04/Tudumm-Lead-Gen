import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decryptCookie } from '@/lib/cookie-cipher'
import { requireMember } from '@/lib/authz'

const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:8007'

const TEST_URLS: Record<string, string> = {
  TWITTER: 'https://twitter.com/home',
  INSTAGRAM: 'https://www.instagram.com/',
}

const COOKIE_CONFIGS: Record<string, { name: string; domain: string }> = {
  TWITTER: { name: 'auth_token', domain: '.twitter.com' },
  INSTAGRAM: { name: 'sessionid', domain: '.instagram.com' },
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireMember()
    if (ctx instanceof NextResponse) return ctx

    const { id } = await params
    const record = await prisma.socialSession.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!record.sessionCookie) {
      return NextResponse.json({ valid: false, reason: 'No cookie stored' })
    }

    const cookieCfg = COOKIE_CONFIGS[record.platform]
    const testUrl = TEST_URLS[record.platform]
    if (!cookieCfg || !testUrl) {
      return NextResponse.json({ valid: false, reason: `Unknown platform: ${record.platform}` })
    }

    let cookies: any[]
    try {
      const raw = decryptCookie(record.sessionCookie)
      cookies = raw.startsWith('[') ? JSON.parse(raw)
        : [{ name: cookieCfg.name, value: raw, domain: cookieCfg.domain, path: '/' }]
    } catch {
      await prisma.socialSession.update({ where: { id }, data: { status: 'EXPIRED' } })
      return NextResponse.json({ valid: false, reason: 'Stored cookie could not be decrypted' })
    }

    let result: any
    try {
      const res = await fetch(`${BROWSER_SERVICE_URL}/browser/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl, waitFor: 'domcontentloaded', cookies }),
        signal: AbortSignal.timeout(60000),
      })
      if (!res.ok) return NextResponse.json({ valid: false, reason: `Browser service error (${res.status})` }, { status: 502 })
      result = await res.json()
    } catch (e: any) {
      return NextResponse.json({ valid: false, reason: `Browser service unreachable: ${e.message}` }, { status: 502 })
    }

    const valid = !result.blocked
    await prisma.socialSession.update({
      where: { id },
      data: { status: valid ? 'ACTIVE' : 'EXPIRED', lastUsedAt: new Date() },
    })

    return NextResponse.json({
      valid,
      status: valid ? 'ACTIVE' : 'EXPIRED',
      reason: valid
        ? 'Session is live and authenticated'
        : (result.blockReason || 'Platform rejected the session — cookie likely expired'),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
