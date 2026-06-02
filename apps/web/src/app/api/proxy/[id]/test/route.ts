import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const config = await prisma.proxyConfig.findFirst({ where: { id, workspaceId } })
    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const start = Date.now()
    try {
      // Verify the proxy endpoint is reachable via a simple HEAD request
      const res = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      })
      const latencyMs = Date.now() - start
      if (res.ok) {
        return NextResponse.json({ ok: true, latencyMs })
      }
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}` })
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err.message ?? 'Connection failed' })
    }
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
