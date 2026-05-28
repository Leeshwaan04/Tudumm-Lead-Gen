import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'

export async function POST() {
  if (process.env.NODE_ENV !== 'development' || process.env.SEED_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    execSync(
      `node --loader ts-node/esm scripts/seed.ts`,
      { cwd: path.join(process.cwd()), stdio: 'pipe', env: { ...process.env } }
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 })
  }
}
