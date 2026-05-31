import { Queue } from 'bullmq'

export type RunJobData = {
  runId: string
  actorId: string
  workspaceId: string
  imageName: string
  input: Record<string, unknown>
  actorSlug?: string
}

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  connectTimeout: 10000,
  maxRetriesPerRequest: null, // Let BullMQ wait for connection
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy: (times: number) => {
    // Exponential backoff with a max of 5 seconds
    return Math.min(Math.pow(2, times) * 50, 5000)
  }
}

// Lazy singleton — Queue instance is only created on first use, not at import time.
// This prevents the module from hanging at startup when Redis is unavailable.
let _queue: Queue | null = null
function getQueue(): Queue {
  if (!_queue) _queue = new Queue('runs', { connection })
  return _queue
}

export async function publishRunJob(data: RunJobData): Promise<void> {
  await getQueue().add('execute', data, {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}

export const runQueue = {
  add: async (name: string, data: RunJobData, opts?: Record<string, unknown>) => {
    try {
      await getQueue().add(name, data, opts)
    } catch (e) {
      console.error('Failed to add job to queue:', e)
      // Redis unavailable — run stays QUEUED in DB, that's fine
    }
  },
}
