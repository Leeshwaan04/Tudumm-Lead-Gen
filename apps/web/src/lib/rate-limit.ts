// Sliding-window in-memory rate limiter — no external dependencies required.
// Works per-IP across serverless invocations within the same process instance.
// For multi-instance deployments (Railway scaled), this is a best-effort guard;
// upgrade to Redis-backed limiting if strict enforcement is needed at scale.

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

// Evict expired entries every 5 minutes to avoid unbounded memory growth.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, win] of store) {
      if (win.resetAt < now) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 * @param key     Unique bucket key (e.g. "register:1.2.3.4")
 * @param limit   Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const win = store.get(key)

  if (!win || win.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (win.count >= limit) return false

  win.count++
  return true
}

/** Extract the best available client IP from a Next.js Request. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return (xff.split(',')[0] ?? '').trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Guard an expensive operation (scrape / enrich / run) by BOTH a short-term
 * burst limit per IP and a daily cap per workspace. Returns an error string if
 * blocked, or null if allowed. Cost/abuse protection for unmetered endpoints.
 */
export function guardExpensive(
  op: string,
  ip: string,
  workspaceId: string,
  opts: { perMinute?: number; perDay?: number } = {},
): string | null {
  const perMinute = opts.perMinute ?? 20
  const perDay = opts.perDay ?? 500
  if (!rateLimit(`${op}:ip:${ip}`, perMinute, 60_000)) {
    return `Rate limit: max ${perMinute} ${op} requests/minute. Slow down and retry shortly.`
  }
  if (!rateLimit(`${op}:ws:${workspaceId}`, perDay, 24 * 60 * 60_000)) {
    return `Daily limit reached: max ${perDay} ${op} runs/day for this workspace.`
  }
  return null
}
