import { Queue } from 'bullmq'

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
}

export const runQueue = new Queue('runs', { connection })

export type RunJobData = {
  runId: string
  actorId: string
  workspaceId: string
  input: Record<string, unknown>
  actorSlug: string
}
