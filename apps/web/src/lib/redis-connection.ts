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
