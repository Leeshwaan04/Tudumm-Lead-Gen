import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { pollKeywordRadar } from '@/lib/keyword-radar'

// Manual "Refresh now" — runs a full radar pass inline (the worker also polls
// automatically every KEYWORD_RADAR_INTERVAL_MIN minutes).
export async function POST() {
  const session = await auth()
  if (!(session as any)?.workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await pollKeywordRadar()
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
