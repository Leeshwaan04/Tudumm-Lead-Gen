import { Worker } from 'bullmq'
import { redisConnection as connection } from '../lib/redis-connection'
import type { WorkflowJobData } from '../lib/queues/workflow-queue'
import { runWorkflow } from '../lib/workflow-runner'
import { captureError } from '../lib/observability'

// Consumes the 'workflows' queue and runs each workflow durably on the worker
// (off the web request path) so long pipelines survive and can retry.
const worker = new Worker<WorkflowJobData>(
  'workflows',
  async (job) => {
    const { workflowId, workspaceId, executionId } = job.data
    await runWorkflow(workflowId, workspaceId, executionId)
  },
  { connection, concurrency: Number(process.env.WORKFLOW_CONCURRENCY ?? 4) },
)

worker.on('failed', (job, err) => {
  console.error(`[WorkflowWorker] job ${job?.id} failed:`, err?.message)
  captureError(err, { kind: 'workflow', workflowId: job?.data?.workflowId, workspaceId: job?.data?.workspaceId })
})

console.log('[WorkflowWorker] listening on "workflows" queue')

export { worker }
