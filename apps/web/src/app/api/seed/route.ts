import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }
  try {
    execSync(
      `~/.nvm/versions/node/v20.20.1/bin/node --loader ts-node/esm scripts/seed.ts`,
      { cwd: path.join(process.cwd()), stdio: 'inherit', env: { ...process.env } }
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
