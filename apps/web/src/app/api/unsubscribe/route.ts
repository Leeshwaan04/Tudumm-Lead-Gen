import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Public, unauthenticated endpoint — reachable from email links.
// CAN-SPAM requires unsubscribe to work without login.

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
  const leadId = searchParams.get('lead') ?? ''
  await unsubscribe(leadId)
  return htmlResponse("You've been unsubscribed.")
}

// POST — RFC 8058 One-Click unsubscribe (List-Unsubscribe-Post)
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('lead') ?? ''
  await unsubscribe(leadId)
  return NextResponse.json({ ok: true })
}
