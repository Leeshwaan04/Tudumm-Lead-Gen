import { Worker } from 'bullmq'
import { prisma } from '../lib/db'
import type { RunJobData } from '../lib/queue'
import crypto from 'crypto'

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
}

const JOB_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CONCURRENT = 3
const activeRunIds = new Set<string>()

async function addLog(runId: string, level: 'INFO' | 'WARN' | 'ERROR', message: string) {
  await prisma.runLog.create({ data: { runId, level, message } })
}

function generateItems(slug: string, count: number): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = []
  for (let i = 0; i < count; i++) {
    if (slug.includes('linkedin')) {
      items.push({
        firstName: `First${i}`,
        lastName: `Last${i}`,
        title: `Engineer ${i}`,
        company: `Company ${i}`,
        email: `user${i}@company${i}.com`,
        linkedinUrl: `https://linkedin.com/in/user${i}`,
      })
    } else if (slug.includes('google-maps')) {
      items.push({
        name: `Business ${i}`,
        address: `${i} Main St, City, State`,
        phone: `+1-555-${String(i).padStart(4, '0')}`,
        rating: (Math.random() * 2 + 3).toFixed(1),
        website: `https://business${i}.com`,
      })
    } else if (slug.includes('twitter')) {
      items.push({
        username: `user${i}`,
        bio: `Bio for user ${i}`,
        followers: Math.floor(Math.random() * 10000),
        tweets: Math.floor(Math.random() * 5000),
      })
    } else if (slug.includes('github')) {
      items.push({
        username: `dev${i}`,
        email: `dev${i}@github.com`,
        location: `City ${i}`,
        repos: Math.floor(Math.random() * 100),
      })
    } else if (slug.includes('instagram')) {
      items.push({
        username: `insta_user${i}`,
        bio: `Instagram bio ${i}`,
        followers: Math.floor(Math.random() * 50000),
        posts: Math.floor(Math.random() * 1000),
      })
    } else {
      items.push({
        title: `Result ${i}`,
        url: `https://example.com/result/${i}`,
        description: `Description for result ${i}`,
        scrapedAt: new Date().toISOString(),
      })
    }
  }
  return items
}

async function simulateActorRun(data: RunJobData): Promise<{ itemsScraped: number; creditsCost: number }> {
  const { runId, actorSlug } = data

  await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date() } })
  await addLog(runId, 'INFO', 'Actor started')
  await new Promise(r => setTimeout(r, 500))

  await addLog(runId, 'INFO', 'Loading input configuration')
  await new Promise(r => setTimeout(r, 300))

  await addLog(runId, 'INFO', 'Launching browser instance')
  await new Promise(r => setTimeout(r, 800))

  const slug = actorSlug ?? 'generic'
  let targetUrl = 'https://example.com'
  if (slug.includes('linkedin')) targetUrl = 'https://linkedin.com/search/results/people'
  else if (slug.includes('google-maps')) targetUrl = 'https://google.com/maps'
  else if (slug.includes('twitter')) targetUrl = 'https://twitter.com/search'
  else if (slug.includes('github')) targetUrl = 'https://github.com/search'
  else if (slug.includes('instagram')) targetUrl = 'https://instagram.com/explore'

  await addLog(runId, 'INFO', `Navigating to ${targetUrl}`)
  await new Promise(r => setTimeout(r, 1000))

  const itemCount = Math.floor(Math.random() * 200) + 50
  await addLog(runId, 'INFO', `Found ${itemCount} results on page 1`)
  await new Promise(r => setTimeout(r, 500))

  await addLog(runId, 'WARN', 'Rate limit detected — backing off 2s')
  await new Promise(r => setTimeout(r, 2000))

  await addLog(runId, 'INFO', 'Resuming scrape...')
  await new Promise(r => setTimeout(r, 1000))

  const creditsCost = Math.floor(itemCount * 0.05)
  await addLog(runId, 'INFO', `Pushed ${itemCount} items to dataset`)
  await addLog(runId, 'INFO', 'Actor finished successfully')

  return { itemsScraped: itemCount, creditsCost }
}

async function deliverWebhooks(workspaceId: string, payload: Record<string, unknown>) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { workspaceId, events: { contains: 'run.completed' } },
    })

    for (const webhook of webhooks) {
      try {
        const body = JSON.stringify(payload)
        const sig = crypto
          .createHmac('sha256', webhook.secret ?? 'default-secret')
          .update(body)
          .digest('hex')

        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tudumm-Signature': `sha256=${sig}`,
            'X-Tudumm-Event': 'run.completed',
          },
          body,
        })
        console.log(`Webhook delivered to ${webhook.url}`)
      } catch (err) {
        console.error(`Webhook delivery failed for ${webhook.url}:`, err)
      }
    }
  } catch (err) {
    console.error('Failed to query webhooks:', err)
  }
}

const worker = new Worker<RunJobData>(
  'runs',
  async (job) => {
    const { runId, workspaceId, actorId } = job.data

    // Rate limiting: max MAX_CONCURRENT active runs
    if (activeRunIds.size >= MAX_CONCURRENT) {
      throw new Error(`Max concurrent runs (${MAX_CONCURRENT}) reached, will retry`)
    }
    activeRunIds.add(runId)

    // Job timeout
    const timeoutHandle = setTimeout(async () => {
      console.error(`Run ${runId} timed out after 5 minutes`)
      try {
        await prisma.run.update({
          where: { id: runId },
          data: { status: 'FAILED', finishedAt: new Date(), errorMessage: 'Job timed out after 5 minutes' },
        })
      } catch { /* ignore */ }
    }, JOB_TIMEOUT_MS)

    try {
      const { itemsScraped, creditsCost } = await simulateActorRun(job.data)

      // Create dataset record
      const dataset = await prisma.dataset.create({
        data: {
          workspaceId,
          runId,
          name: `${job.data.actorSlug} - ${new Date().toLocaleDateString()}`,
          itemCount: itemsScraped,
          sizeBytes: itemsScraped * 512,
          s3Key: `datasets/${workspaceId}/${runId}/data.json`,
        },
      })

      // Credits are not charged — Tudumm is free for all users.
      // creditsCost is still recorded on the run for display/analytics only.

      const durationMs = Math.floor(Math.random() * 300000) + 60000

      await prisma.run.update({
        where: { id: runId },
        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
          durationMs,
          creditsCost,
          output: JSON.stringify({ itemsScraped, datasetId: dataset.id }),
        },
      })

      // Update schedule lastRunAt/lastRunStatus if applicable
      try {
        const schedule = await prisma.schedule.findFirst({
          where: { actorId, workspaceId },
        })
        if (schedule) {
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: { lastRunAt: new Date(), lastRunStatus: 'SUCCEEDED' },
          })
        }
      } catch (err) {
        console.error('Failed to update schedule:', err)
      }

      // Deliver webhooks
      await deliverWebhooks(workspaceId, {
        event: 'run.completed',
        runId,
        workspaceId,
        actorId,
        actorSlug: job.data.actorSlug,
        status: 'SUCCEEDED',
        itemsScraped,
        datasetId: dataset.id,
        durationMs,
        creditsCost,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      await prisma.run.update({
        where: { id: runId },
        data: { status: 'FAILED', finishedAt: new Date(), errorMessage: String(err) },
      })
      throw err
    } finally {
      clearTimeout(timeoutHandle)
      activeRunIds.delete(runId)
    }
  },
  { connection, concurrency: MAX_CONCURRENT }
)

worker.on('completed', job => console.log(`Run ${job.data.runId} completed`))
worker.on('failed', (job, err) => console.error(`Run ${job?.data.runId} failed:`, err))

console.log('BullMQ run worker started')
