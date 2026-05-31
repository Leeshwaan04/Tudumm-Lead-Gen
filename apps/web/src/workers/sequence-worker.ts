import { Worker, Job } from 'bullmq'
import { SequenceJobData } from '../lib/queues/sequence-queue'
import { processSequenceBatch } from '../lib/sequences/executor'

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
}

export const sequenceWorker = new Worker<SequenceJobData>(
  'sequences',
  async (job: Job<SequenceJobData>) => {
    console.log(`[SequenceWorker] Processing sequence ${job.data.sequenceId} (Attempt ${job.attemptsMade + 1})`)
    const result = await processSequenceBatch(job.data.sequenceId, job.data.workspaceId)
    console.log(`[SequenceWorker] Sequence ${job.data.sequenceId} processed. Processed: ${result.processed}, Errors: ${result.errors}`)
    
    // If there were errors, we might want to throw to let BullMQ retry, 
    // but processSequenceBatch handles individual lead errors by skipping them and letting them be picked up later.
    // If processSequenceBatch completely fails (e.g., db error, no session), it throws and BullMQ will retry the job.
    return result
  },
  {
    connection,
    concurrency: 5,
  }
)

sequenceWorker.on('completed', (job) => {
  console.log(`[SequenceWorker] Job ${job.id} completed.`)
})

sequenceWorker.on('failed', (job, err) => {
  console.error(`[SequenceWorker] Job ${job?.id} failed:`, err.message)
})
