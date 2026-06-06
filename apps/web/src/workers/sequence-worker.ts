import { Worker, Job } from 'bullmq'
import { SequenceJobData } from '../lib/queues/sequence-queue'
import { processSequenceBatch } from '../lib/sequences/executor'
import { redisConnection as connection } from '../lib/redis-connection'
import { captureError } from '../lib/observability'

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
    concurrency: Number(process.env.SEQUENCE_CONCURRENCY ?? 5),
  }
)

sequenceWorker.on('completed', (job) => {
  console.log(`[SequenceWorker] Job ${job.id} completed.`)
})

sequenceWorker.on('failed', (job, err) => {
  console.error(`[SequenceWorker] Job ${job?.id} failed:`, err.message)
  captureError(err, { kind: 'sequence', jobId: job?.id })
})
