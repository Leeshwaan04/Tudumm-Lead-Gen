import { Queue } from 'bullmq'

export type RunJobData = {
  runId: string
  actorId: string
  workspaceId: string
  input: Record<string, unknown>
  actorSlug: string
}

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  connectTimeout: 2000,
  maxRetriesPerRequest: 0,
  enableReadyCheck: false,
  lazyConnect: true,
}

// Lazy singleton — Queue instance is only created on first use, not at import time.
// This prevents the module from hanging at startup when Redis is unavailable.
let _queue: Queue | null = null
function getQueue(): Queue {
  if (!_queue) _queue = new Queue('runs', { connection })
  return _queue
}

export const runQueue = {
  add: async (name: string, data: RunJobData, opts?: Record<string, unknown>) => {
    try {
      await Promise.race([
        getQueue().add(name, data, opts),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
      ])
    } catch {
      // Redis unavailable in local dev — run stays QUEUED in DB, that's fine
    }
  },
}
