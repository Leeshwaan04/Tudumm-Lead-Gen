import crypto from 'crypto'

/**
 * Dependency-free error reporting compatible with GlitchTip / Sentry.
 *
 * Set SENTRY_DSN (a GlitchTip or Sentry DSN, e.g.
 * https://<publicKey>@<host>/<projectId>) and errors are POSTed to the project's
 * store endpoint. Without a DSN it just logs to stderr — so it's safe to call
 * everywhere and "activates" the moment you paste a DSN. No SDK, no build cost.
 */
let dsnParts: { host: string; projectId: string; publicKey: string; protocol: string } | null | undefined

function parseDsn() {
  if (dsnParts !== undefined) return dsnParts
  const dsn = process.env.SENTRY_DSN || process.env.GLITCHTIP_DSN
  if (!dsn) { dsnParts = null; return null }
  try {
    const u = new URL(dsn)
    dsnParts = {
      protocol: u.protocol.replace(':', ''),
      host: u.host,
      publicKey: u.username,
      projectId: u.pathname.replace(/^\//, ''),
    }
  } catch {
    dsnParts = null
  }
  return dsnParts
}

export async function captureError(err: unknown, context: Record<string, unknown> = {}) {
  const e = err instanceof Error ? err : new Error(String(err))
  // Always log — visible in Railway logs even with no DSN.
  console.error('[captureError]', e.message, JSON.stringify(context), e.stack?.split('\n').slice(0, 3).join(' | '))

  const d = parseDsn()
  if (!d) return
  try {
    const event = {
      event_id: crypto.randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: 'error',
      logger: 'tudumm',
      server_name: process.env.RAILWAY_SERVICE_NAME || 'tudumm',
      environment: process.env.NODE_ENV || 'production',
      tags: context,
      exception: { values: [{ type: e.name, value: e.message, stacktrace: { frames: (e.stack || '').split('\n').slice(1, 12).map(l => ({ function: l.trim() })) } }] },
    }
    await fetch(`${d.protocol}://${d.host}/api/${d.projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${d.publicKey}, sentry_client=tudumm/1.0`,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    /* never let error reporting break the caller */
  }
}
