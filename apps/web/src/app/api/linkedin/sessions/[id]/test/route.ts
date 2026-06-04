import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { decryptCookie } from '@/lib/cookie-cipher'

const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:8007'

/** Build the Playwright cookie array from a stored li_at token or JSON cookie array. */
function toCookieArray(raw: string): any[] {
  if (raw.startsWith('[')) {
    try { return JSON.parse(raw) } catch { /* fall through */ }
  }
  return [{ name: 'li_at', value: raw, domain: '.linkedin.com', path: '/' }]
}

/**
 * POST /api/linkedin/sessions/[id]/test
 * Validate the stored session cookie by doing an authenticated fetch of the
 * LinkedIn feed via browser-service. Updates status to ACTIVE or EXPIRED so the
 * user gets instant feedback instead of discovering a dead cookie via a failed run.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const record = await prisma.linkedInSession.findFirst({ where: { id, workspaceId } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!record.sessionCookie) {
      return NextResponse.json({ valid: false, reason: 'No cookie stored' }, { status: 200 })
    }

    let cookies: any[]
    try {
      cookies = toCookieArray(decryptCookie(record.sessionCookie))
    } catch {
      await prisma.linkedInSession.update({ where: { id }, data: { status: 'EXPIRED' } })
      return NextResponse.json({ valid: false, reason: 'Stored cookie could not be decrypted' })
    }

    // Authenticated fetch of the feed. A valid li_at lands on /feed; a dead one is
    // redirected to an auth wall, which browser-service reports as blocked.
    let result: any
    try {
      const res = await fetch(`${BROWSER_SERVICE_URL}/browser/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.linkedin.com/feed/', waitFor: 'domcontentloaded', cookies }),
        signal: AbortSignal.timeout(60000),
      })
      if (!res.ok) {
        return NextResponse.json({ valid: false, reason: `Browser service error (${res.status})` }, { status: 502 })
      }
      result = await res.json()
    } catch (e: any) {
      return NextResponse.json({ valid: false, reason: `Browser service unreachable: ${e.message}` }, { status: 502 })
    }

    const valid = !result.blocked
    await prisma.linkedInSession.update({
      where: { id },
      data: { status: valid ? 'ACTIVE' : 'EXPIRED', lastUsedAt: new Date() },
    })

    return NextResponse.json({
      valid,
      reason: valid ? 'Session is live and authenticated' : (result.blockReason || 'LinkedIn rejected the session (cookie likely expired)'),
      status: valid ? 'ACTIVE' : 'EXPIRED',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
