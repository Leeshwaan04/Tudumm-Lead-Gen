import { Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis-connection'

export type WorkflowJobData = {
  workflowId: string
  workspaceId: string
  executionId: string
}

const connection = { ...redisConnection, connectTimeout: 10000 }

let _queue: Queue | null = null
function getWorkflowQueue(): Queue {
  if (!_queue) _queue = new Queue('workflows', { connection })
  return _queue
}

/**
 * Enqueue a workflow execution to run on the worker — NOT in the web request.
 * A real pipeline (scrape + a Groq call per lead) can run for minutes; running
 * it inline in the HTTP handler risks being killed mid-run. The worker runs it
 * durably with retries.
 */
export async function publishWorkflowJob(data: WorkflowJobData): Promise<void> {
  await getWorkflowQueue().add('execute-workflow', data, {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  })
}
