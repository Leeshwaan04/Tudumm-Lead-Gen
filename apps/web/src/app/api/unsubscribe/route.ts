import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/sign'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Public, unauthenticated endpoint — reachable from email links.
// CAN-SPAM requires unsubscribe to work without login.

// Resolve the lead id from a `lead` param that is EITHER a signed token
// (new links) or a bare id (legacy links). Signed tokens are trusted directly;
// bare ids are honored for backward compatibility but the caller rate-limits
// them so the endpoint can't be used to mass-unsubscribe by enumeration.
function resolveLeadId(raw: string): { leadId: string; signed: boolean } {
  const verified = verifyToken(raw)
  if (verified) return { leadId: verified, signed: true }
  return { leadId: raw, signed: false }
}

async function unsubscribe(leadId: string): Promise<boolean> {
  if (!leadId) return false
  const result = await prisma.lead.updateMany({
    where: { id: leadId, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  })
  // Also mark any active sequence enrollments as completed
  await prisma.sequenceLead.updateMany({
    where: { leadId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    data: { status: 'UNSUBSCRIBED', claimedAt: null, claimedBy: null },
  })
  return result.count > 0 || true
}

function htmlResponse(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;text-align:center;padding:64px;color:#111">
      <h1 style="font-size:20px">${message}</h1>
      <p style="color:#666">You can close this window.</p>
    </body></html>`,
    { status: 200, headers: { 'content-type': 'text/html' } }
  )
}

// GET — link click from email
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const { leadId, signed } = resolveLeadId(searchParams.get('lead') ?? '')
  // Legacy (unsigned) links are rate-limited per IP to block enumeration abuse.
  if (!signed && !rateLimit(`unsub:${getClientIp(req)}`, 10, 60_000)) {
    return htmlResponse('Too many requests — please try again shortly.')
  }
  await unsubscribe(leadId)
  return htmlResponse("You've been unsubscribed.")
}

// POST — RFC 8058 One-Click unsubscribe (List-Unsubscribe-Post)
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const { leadId, signed } = resolveLeadId(searchParams.get('lead') ?? '')
  if (!signed && !rateLimit(`unsub:${getClientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  await unsubscribe(leadId)
  return NextResponse.json({ ok: true })
}
