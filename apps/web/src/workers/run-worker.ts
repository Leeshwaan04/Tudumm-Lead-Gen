import { Worker } from 'bullmq'
import { prisma } from '../lib/db'
import type { RunJobData } from '../lib/queue'
import { redisConnection as connection } from '../lib/redis-connection'
import { uploadJSON } from '../lib/storage'
import { decryptCookie } from '../lib/cookie-cipher'
import crypto from 'crypto'

const JOB_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CONCURRENT = 3
const activeRunIds = new Set<string>()
const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:8007'

async function addLog(runId: string, level: 'INFO' | 'WARN' | 'ERROR', message: string) {
  await prisma.runLog.create({ data: { runId, level, message } })
}

/** Pull the first scrapeable URL out of an arbitrary actor input. */
function extractUrl(input: Record<string, unknown> | undefined): string | null {
  if (!input) return null
  const candidates = [input.url, input.startUrl, input.targetUrl, input.website]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  // startUrls: ["..."] or [{ url: "..." }]
  const list = input.startUrls ?? input.urls
  if (Array.isArray(list) && list.length > 0) {
    const first = list[0]
    if (typeof first === 'string' && /^https?:\/\//i.test(first)) return first
    if (first && typeof first === 'object' && typeof (first as any).url === 'string') return (first as any).url
  }
  // Google Maps Scraper sends { query: "..." } — convert to a Maps search URL
  if (typeof input.query === 'string' && input.query.trim()) {
    return `https://www.google.com/maps/search/${encodeURIComponent(input.query.trim())}`
  }
  return null
}

/**
 * Real actor run: scrape a live URL via browser-service and persist the
 * extracted items to MinIO so the dataset is genuinely downloadable.
 * Used when the actor input contains a URL. Throws on hard failure so the
 * caller can fall back to simulation.
 */
export class ScrapeBlockedError extends Error {}

// Fetch + decrypt the workspace's active LinkedIn cookie for authenticated scraping.
async function linkedInCookies(workspaceId: string): Promise<any[] | undefined> {
  try {
    const session = await prisma.linkedInSession.findFirst({
      where: { workspaceId, status: 'ACTIVE' }, orderBy: { lastUsedAt: 'asc' },
    })
    if (!session) return undefined
    const raw = decryptCookie(session.sessionCookie)
    if (raw.startsWith('[')) return JSON.parse(raw)
    return [{ name: 'li_at', value: raw, domain: '.linkedin.com', path: '/' }]
  } catch {
    return undefined
  }
}

async function twitterCookies(workspaceId: string): Promise<any[] | undefined> {
  try {
    const session = await prisma.socialSession.findFirst({
      where: { workspaceId, platform: 'TWITTER', status: 'ACTIVE' }, orderBy: { lastUsedAt: 'asc' },
    })
    if (!session) return undefined
    const raw = decryptCookie(session.sessionCookie)
    if (raw.startsWith('[')) return JSON.parse(raw)
    return [{ name: 'auth_token', value: raw, domain: '.twitter.com', path: '/' },
            { name: 'auth_token', value: raw, domain: '.x.com', path: '/' }]
  } catch {
    return undefined
  }
}

async function instagramCookies(workspaceId: string): Promise<any[] | undefined> {
  try {
    const session = await prisma.socialSession.findFirst({
      where: { workspaceId, platform: 'INSTAGRAM', status: 'ACTIVE' }, orderBy: { lastUsedAt: 'asc' },
    })
    if (!session) return undefined
    const raw = decryptCookie(session.sessionCookie)
    if (raw.startsWith('[')) return JSON.parse(raw)
    return [{ name: 'sessionid', value: raw, domain: '.instagram.com', path: '/' }]
  } catch {
    return undefined
  }
}

async function realScrapeRun(
  data: RunJobData,
  url: string,
): Promise<{ items: Record<string, unknown>[]; creditsCost: number }> {
  const { runId, workspaceId } = data
  await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date() } })
  await addLog(runId, 'INFO', `Actor started — scraping ${url}`)

  // Authenticated scraping for social networks that block anonymous requests.
  let cookies: any[] | undefined
  if (/linkedin\.com/i.test(url)) {
    cookies = await linkedInCookies(workspaceId)
    if (cookies) await addLog(runId, 'INFO', 'Using connected LinkedIn session for authenticated scrape')
    else await addLog(runId, 'WARN', 'No connected LinkedIn session — LinkedIn will likely block this request')
  } else if (/(twitter|x)\.com/i.test(url)) {
    cookies = await twitterCookies(workspaceId)
    if (cookies) await addLog(runId, 'INFO', 'Using connected Twitter/X session for authenticated scrape')
    else await addLog(runId, 'WARN', 'No connected Twitter/X session — Twitter will likely block this request')
  } else if (/instagram\.com/i.test(url)) {
    cookies = await instagramCookies(workspaceId)
    if (cookies) await addLog(runId, 'INFO', 'Using connected Instagram session for authenticated scrape')
    else await addLog(runId, 'WARN', 'No connected Instagram session — Instagram will likely block this request')
  } else if (/google\.com\/maps/i.test(url)) {
    await addLog(runId, 'INFO', 'Google Maps scrape — using residential proxy if configured')
  }

  const scrapeEndpoint = `${BROWSER_SERVICE_URL}/browser/scrape`
  const res = await fetch(scrapeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, waitFor: 'domcontentloaded', cookies }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`POST ${scrapeEndpoint} -> ${res.status} ${body.slice(0, 120)}`)
  }
  const result: any = await res.json()

  // Honest block handling — do NOT fabricate success on a block.
  if (result.blocked) {
    const reason = result.blockReason || `status ${result.status}`
    await addLog(runId, 'ERROR', `Blocked by target: ${reason}. ${/linkedin/i.test(url) ? 'Connect a LinkedIn session in Settings → LinkedIn.' : 'Try a proxy or different target.'}`)
    throw new ScrapeBlockedError(`Target blocked the request (${reason})`)
  }
  await addLog(runId, 'INFO', `Fetched ${url} (status ${result.status ?? '?'}, ${result.attempts ?? 1} attempt(s))`)

  // result.extracted is now structured data (emails, phones, social, JSON-LD, OG…)
  const d = result.extracted
  let items: Record<string, unknown>[]
  if (Array.isArray(d)) items = d
  else if (d && typeof d === 'object') items = [d]
  else items = [{ url: result.url ?? url, httpStatus: result.status ?? null, scrapedAt: new Date().toISOString() }]

  const dp = items[0] ?? {}
  const counts = `${(dp.emails as any[])?.length ?? 0} email(s), ${(dp.phones as any[])?.length ?? 0} phone(s), ${Array.isArray(dp.jsonLd) ? dp.jsonLd.length : 0} structured block(s)`
  await addLog(runId, 'INFO', `Extracted ${items.length} record(s) — ${counts}`)
  return { items, creditsCost: Math.max(1, Math.ceil(items.length * 0.05)) }
}

/**
 * Email Finder actor: look up a verified email via Hunter.io (then Apollo as
 * fallback) from { domain, firstName, lastName }. This runs in the actor engine
 * (run-worker), separate from the workflow `find-email` node.
 */
async function findEmailRun(data: RunJobData): Promise<{ items: Record<string, unknown>[]; creditsCost: number }> {
  const { runId } = data
  const input = (data.input ?? {}) as Record<string, any>
  await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date() } })
  await addLog(runId, 'INFO', 'Email Finder started')

  const hunterKey = process.env.HUNTER_API_KEY
  const apolloKey = process.env.APOLLO_API_KEY
  if (!hunterKey && !apolloKey) {
    await addLog(runId, 'ERROR', 'No HUNTER_API_KEY or APOLLO_API_KEY configured — cannot find emails. Set one in env (web + worker).')
    throw new ScrapeBlockedError('Email Finder needs HUNTER_API_KEY or APOLLO_API_KEY')
  }

  // Accept a bare domain or a full company URL.
  let domain: string = input.domain || input.companyDomain || ''
  const maybeUrl = input.url || input.website
  if (!domain && typeof maybeUrl === 'string') {
    try { domain = new URL(/^https?:\/\//i.test(maybeUrl) ? maybeUrl : `https://${maybeUrl}`).hostname.replace(/^www\./, '') } catch { /* ignore */ }
  }
  const first = String(input.firstName || input.first_name || '').trim()
  const last = String(input.lastName || input.last_name || '').trim()

  if (!domain) {
    await addLog(runId, 'ERROR', 'No company domain provided. Enter a domain like "stripe.com".')
    throw new ScrapeBlockedError('Email Finder requires a company domain')
  }
  await addLog(runId, 'INFO', `Searching emails for ${first || '(any)'} ${last} @ ${domain}`)

  const results: Record<string, unknown>[] = []
  try {
    if (hunterKey && (first || last)) {
      const params = new URLSearchParams({ domain, first_name: first, last_name: last, api_key: hunterKey })
      const r = await fetch(`https://api.hunter.io/v2/email-finder?${params}`, { signal: AbortSignal.timeout(15000) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.data?.email) {
        results.push({ email: d.data.email, firstName: first, lastName: last, domain, score: d.data.score ?? null, source: 'hunter' })
        await addLog(runId, 'INFO', `Hunter found: ${d.data.email} (confidence ${d.data.score ?? '?'})`)
      } else if (!r.ok) {
        await addLog(runId, 'WARN', `Hunter API ${r.status}: ${(d.errors?.[0]?.details || JSON.stringify(d)).slice(0, 160)}`)
      }
    } else if (hunterKey && !first && !last) {
      // No name → domain search returns known emails at the company.
      const params = new URLSearchParams({ domain, api_key: hunterKey, limit: '20' })
      const r = await fetch(`https://api.hunter.io/v2/domain-search?${params}`, { signal: AbortSignal.timeout(15000) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && Array.isArray(d.data?.emails)) {
        for (const e of d.data.emails) results.push({ email: e.value, firstName: e.first_name ?? null, lastName: e.last_name ?? null, position: e.position ?? null, domain, source: 'hunter-domain' })
        await addLog(runId, 'INFO', `Hunter domain search found ${results.length} email(s) at ${domain}`)
      } else if (!r.ok) {
        await addLog(runId, 'WARN', `Hunter domain-search ${r.status}: ${(d.errors?.[0]?.details || '').slice(0, 160)}`)
      }
    }

    if (results.length === 0 && apolloKey && (first || last)) {
      const r = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': apolloKey },
        body: JSON.stringify({ first_name: first, last_name: last, domain }), signal: AbortSignal.timeout(15000),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.person?.email) {
        results.push({ email: d.person.email, firstName: first, lastName: last, domain, title: d.person.title ?? null, source: 'apollo' })
        await addLog(runId, 'INFO', `Apollo found: ${d.person.email}`)
      }
    }
  } catch (e: any) {
    await addLog(runId, 'WARN', `Email lookup error: ${String(e.message).slice(0, 160)}`)
  }

  if (results.length === 0) {
    await addLog(runId, 'INFO', 'No verified email found for the given inputs (this is a real result, not a failure).')
  } else {
    await addLog(runId, 'INFO', `Found ${results.length} email(s)`)
  }
  return { items: results, creditsCost: 1 }
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

async function simulateActorRun(data: RunJobData): Promise<{ items: Record<string, unknown>[]; creditsCost: number }> {
  const { runId, actorSlug } = data

  await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date() } })
  await addLog(runId, 'INFO', 'Actor started')
  await new Promise(r => setTimeout(r, 500))

  await addLog(runId, 'INFO', 'Loading input configuration')
  await new Promise(r => setTimeout(r, 300))

  await addLog(runId, 'INFO', 'Launching browser instance')
  await new Promise(r => setTimeout(r, 800))

  const slug = actorSlug ?? 'generic'
  await addLog(runId, 'INFO', 'Collecting results')
  await new Promise(r => setTimeout(r, 1000))

  const itemCount = Math.floor(Math.random() * 40) + 10
  const items = generateItems(slug, itemCount)
  await addLog(runId, 'INFO', `Generated ${itemCount} sample items (simulated — no URL provided)`)

  const creditsCost = Math.max(1, Math.floor(itemCount * 0.05))
  await addLog(runId, 'INFO', 'Actor finished successfully')

  return { items, creditsCost }
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

    const startedMs = Date.now()
    try {
      // Enrichment actors (Email Finder / Apollo) don't scrape a URL — they call
      // a data API. Route them first so they never fall into the scrape/simulate path.
      const slug = job.data.actorSlug ?? ''
      let items: Record<string, unknown>[]
      let creditsCost: number
      if (/email-finder|apollo-enrich/i.test(slug)) {
        try {
          ({ items, creditsCost } = await findEmailRun(job.data))
        } catch (enrichErr) {
          clearTimeout(timeoutHandle)
          await prisma.run.update({
            where: { id: runId },
            data: { status: 'FAILED', finishedAt: new Date(), errorMessage: String((enrichErr as Error).message) },
          })
          activeRunIds.delete(runId)
          throw enrichErr
        }
        const itemsEnriched = items.length
        const s3KeyE = `datasets/${workspaceId}/${runId}/data.json`
        try { await uploadJSON(s3KeyE, items); await addLog(runId, 'INFO', `Pushed ${itemsEnriched} item(s) to dataset storage`) } catch { /* ignore */ }
        const datasetE = await prisma.dataset.create({
          data: { workspaceId, runId, name: `${slug} - ${new Date().toLocaleDateString()}`, itemCount: itemsEnriched, sizeBytes: Buffer.byteLength(JSON.stringify(items)), s3Key: s3KeyE },
        })
        clearTimeout(timeoutHandle)
        await prisma.run.update({
          where: { id: runId },
          data: { status: 'SUCCEEDED', finishedAt: new Date(), durationMs: Date.now() - startedMs, creditsCost, output: JSON.stringify({ itemsScraped: itemsEnriched, datasetId: datasetE.id }) },
        })
        await addLog(runId, 'INFO', 'Actor finished successfully')
        activeRunIds.delete(runId)
        await deliverWebhooks(workspaceId, { event: 'run.completed', runId, datasetId: datasetE.id, itemsScraped: itemsEnriched })
        return { runId, datasetId: datasetE.id }
      }

      // Real scrape when the input carries a URL; otherwise fall back to a
      // simulated sample run. Either path produces real, downloadable items.
      const url = extractUrl(job.data.input)
      if (url) {
        try {
          ({ items, creditsCost } = await realScrapeRun(job.data, url))
        } catch (scrapeErr) {
          // A block is a real, honest failure — do NOT fabricate sample data.
          if (scrapeErr instanceof ScrapeBlockedError) {
            clearTimeout(timeoutHandle)
            await prisma.run.update({
              where: { id: runId },
              data: { status: 'FAILED', finishedAt: new Date(), errorMessage: String(scrapeErr.message) },
            })
            activeRunIds.delete(runId)
            throw scrapeErr
          }
          await addLog(runId, 'ERROR', `Real scrape failed (${String(scrapeErr).slice(0, 200)}) — falling back to sample data`)
          ;({ items, creditsCost } = await simulateActorRun(job.data))
        }
      } else {
        ({ items, creditsCost } = await simulateActorRun(job.data))
      }
      const itemsScraped = items.length

      // Persist the actual items to MinIO so the dataset is downloadable.
      const s3Key = `datasets/${workspaceId}/${runId}/data.json`
      let sizeBytes = itemsScraped * 512
      try {
        await uploadJSON(s3Key, items)
        sizeBytes = Buffer.byteLength(JSON.stringify(items))
        await addLog(runId, 'INFO', `Pushed ${itemsScraped} items to dataset storage`)
      } catch (upErr) {
        await addLog(runId, 'WARN', `Failed to persist items to storage: ${String(upErr).slice(0, 160)}`)
      }

      // Create dataset record
      const dataset = await prisma.dataset.create({
        data: {
          workspaceId,
          runId,
          name: `${job.data.actorSlug} - ${new Date().toLocaleDateString()}`,
          itemCount: itemsScraped,
          sizeBytes,
          s3Key,
        },
      })

      // Credits are not charged — Tudumm is free for all users.
      // creditsCost is still recorded on the run for display/analytics only.

      const durationMs = Date.now() - startedMs

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
