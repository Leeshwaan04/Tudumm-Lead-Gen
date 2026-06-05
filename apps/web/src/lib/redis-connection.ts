// Shared BullMQ/ioredis connection config. Railway Redis requires auth, so the
// password must be included. Prefers REDIS_URL when provided, else falls back
// to discrete host/port/password env vars.
function parseRedisUrl(url: string) {
  try {
    const u = new URL(url)
    return {
      host: u.hostname,
      port: parseInt(u.port || '6379', 10),
      password: u.password || undefined,
      username: u.username || undefined,
    }
  } catch {
    return null
  }
}

const fromUrl = process.env.REDIS_URL ? parseRedisUrl(process.env.REDIS_URL) : null

export const redisConnection = {
  host: fromUrl?.host ?? process.env.REDIS_HOST ?? 'localhost',
  port: fromUrl?.port ?? parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: fromUrl?.password ?? process.env.REDIS_PASSWORD ?? undefined,
  username: fromUrl?.username ?? process.env.REDIS_USERNAME ?? undefined,
  maxRetriesPerRequest: null,
}

// Shared Redis client for app-level caching + distributed throttling/locks
// (separate from the BullMQ connection). Lazy singleton.
import Redis from 'ioredis'
let _cache: Redis | null = null
export function getRedis(): Redis {
  if (!_cache) _cache = new Redis({ ...redisConnection, lazyConnect: false })
  return _cache
}

/**
 * Distributed rate gate — ensures at most one caller proceeds per `everyMs`
 * window across ALL worker replicas (e.g. Nominatim's ≤1 req/sec policy).
 * Returns once the gate is acquired. Falls open if Redis is unavailable.
 */
export async function rateGate(key: string, everyMs: number, maxWaitMs = 15000): Promise<void> {
  const r = getRedis()
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    try {
      const ok = await r.set(`gate:${key}`, '1', 'PX', everyMs, 'NX')
      if (ok) return
    } catch { return } // Redis down → don't block the job
    await new Promise(res => setTimeout(res, Math.min(250, everyMs / 4)))
  }
}
