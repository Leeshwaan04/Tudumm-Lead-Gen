import { Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis-connection'

export type SequenceJobData = {
  sequenceId: string
  workspaceId: string
}

const connection = { ...redisConnection, connectTimeout: 10000 }

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
