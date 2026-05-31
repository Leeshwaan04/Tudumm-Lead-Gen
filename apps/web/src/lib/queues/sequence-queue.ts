import { Queue } from 'bullmq'

export type SequenceJobData = {
  sequenceId: string
  workspaceId: string
}

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  connectTimeout: 10000,
  maxRetriesPerRequest: null,
}

let _sequenceQueue: Queue | null = null
function getSequenceQueue(): Queue {
  if (!_sequenceQueue) _sequenceQueue = new Queue('sequences', { connection })
  return _sequenceQueue
}

export async function publishSequenceJob(data: SequenceJobData): Promise<void> {
  await getSequenceQueue().add('execute-sequence', data, {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}
