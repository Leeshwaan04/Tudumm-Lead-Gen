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

  // JS-heavy sites need render time. Maps/Twitter never reach networkidle
  // (constant background XHR/tiles) → use 'load'; others networkidle.
  const neverIdle = /google\.[^/]+\/maps|(twitter|x)\.com/i.test(url)
  const dynamic = /linkedin\.com|instagram\.com|producthunt\.com/i.test(url)
  const waitFor = neverIdle ? 'load' : dynamic ? 'networkidle' : 'domcontentloaded'

  const scrapeEndpoint = `${BROWSER_SERVICE_URL}/browser/scrape`
  const res = await fetch(scrapeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, waitFor, cookies }),
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

  // Prefer per-site structured output: list records > single site object > generic.
  const d = result.extracted ?? {}
  let items: Record<string, unknown>[]
  if (Array.isArray(d.records) && d.records.length) {
    items = d.records
  } else if (d.site && typeof d.site === 'object') {
    items = [{ ...d.site, emails: d.emails, phones: d.phones, social: d.social }]
  } else if (Array.isArray(d)) {
    items = d
  } else if (d && typeof d === 'object') {
    items = [d]
  } else {
    items = [{ url: result.url ?? url, httpStatus: result.status ?? null, scrapedAt: new Date().toISOString() }]
  }

  const dp: any = items[0] ?? {}
  const kind = dp.type ? `${dp.type}` : `${(dp.emails as any[])?.length ?? 0} email(s), ${(dp.phones as any[])?.length ?? 0} phone(s)`
  await addLog(runId, 'INFO', `Extracted ${items.length} record(s) — ${kind}`)
  return { items, creditsCost: Math.max(1, Math.ceil(items.length * 0.05)) }
}

/**
 * Email Finder actor: look up a verified email via Hunter.io (then Apollo as
 * fallback) from { domain, firstName, lastName }. This runs in the actor engine
 * (run-worker), separate from the workflow `find-email` node.
 */
async function findEmailRun(data: RunJobData): Promise<{ items: Record<string, unknown>[]; creditsCost: number }> {
  const { runId, workspaceId } = data
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

  // Apollo people-search builds a LIST by criteria (title/company/keywords) — it
  // doesn't need a person or even a domain.
  const isApolloSearch = /apollo/i.test(data.actorSlug ?? '') && !first && !last &&
    !!(input.title || input.titles || input.keywords || input.query)
  if (!domain && !isApolloSearch) {
    await addLog(runId, 'ERROR', 'No company domain provided. Enter a domain like "stripe.com".')
    throw new ScrapeBlockedError('Email Finder requires a company domain')
  }
  await addLog(runId, 'INFO', isApolloSearch
    ? `Apollo people search: ${input.title || input.titles || input.keywords || input.query}`
    : `Searching emails for ${first || '(any)'} ${last} @ ${domain}`)

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
      // Hunter's free plan caps domain-search at 10 results; 10 is the safe default.
      const params = new URLSearchParams({ domain, api_key: hunterKey, limit: '10' })
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

    // Apollo People Search — build a lead list by criteria (the people-search API).
    if (results.length === 0 && apolloKey && isApolloSearch) {
      const titles = input.titles || (input.title ? [input.title] : undefined)
      const body: Record<string, unknown> = { page: 1, per_page: 25 }
      if (titles) body.person_titles = titles
      if (domain) body.q_organization_domains = [domain]
      if (input.keywords || input.query) body.q_keywords = input.keywords || input.query
      const r = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': apolloKey },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && Array.isArray(d.people)) {
        for (const pp of d.people) {
          const em = pp.email && !/email_not_unlocked|domain\.com$/i.test(pp.email) ? pp.email : null
          results.push({
            email: em,
            firstName: pp.first_name ?? null, lastName: pp.last_name ?? null,
            title: pp.title ?? null, company: pp.organization?.name ?? null,
            linkedinUrl: pp.linkedin_url ?? null,
            domain: pp.organization?.primary_domain ?? domain ?? null,
            source: 'apollo-search',
          })
        }
        await addLog(runId, 'INFO', `Apollo search returned ${results.length} people`)
      } else if (!r.ok) {
        await addLog(runId, 'WARN', `Apollo search ${r.status}: ${JSON.stringify(d).slice(0, 160)}`)
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

  // Surface found contacts on the Leads page too. Actor runs previously only
  // produced a Dataset, so the Leads list stayed empty — this closes that gap.
  let leadsCreated = 0
  for (const r of results) {
    const email = r.email ? String(r.email) : null
    if (!email) continue
    const exists = await prisma.lead.findFirst({ where: { workspaceId, email, deletedAt: null } })
    if (exists) continue
    const fn = (r.firstName as string) || ''
    const ln = (r.lastName as string) || ''
    await prisma.lead.create({
      data: {
        workspaceId,
        email,
        emailStatus: 'FOUND',
        firstName: fn || null,
        lastName: ln || null,
        fullName: `${fn} ${ln}`.trim() || email,
        company: (r.company as string) || null,
        companyDomain: (r.domain as string) || domain || null,
        title: (r.title as string) || (r.position as string) || null,
        source: /apollo/i.test(data.actorSlug ?? '') ? 'Apollo Enricher' : 'Email Finder',
      },
    }).catch(() => {})
    leadsCreated++
  }
  if (leadsCreated > 0) await addLog(runId, 'INFO', `Added ${leadsCreated} new lead(s) to your Leads list`)

  return { items: results, creditsCost: 1 }
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

      // Real scrape only. We NEVER fabricate sample data — an empty/failed scrape
      // is reported honestly so users can trust every dataset.
      const url = extractUrl(job.data.input)
      if (!url) {
        clearTimeout(timeoutHandle)
        await addLog(runId, 'ERROR', 'No target provided. Give this actor a URL (or a search query for Google Maps).')
        await prisma.run.update({
          where: { id: runId },
          data: { status: 'FAILED', finishedAt: new Date(), errorMessage: 'No target URL or query provided' },
        })
        activeRunIds.delete(runId)
        return { runId, datasetId: null }
      }
      try {
        ({ items, creditsCost } = await realScrapeRun(job.data, url))
      } catch (scrapeErr) {
        // Block or any scrape failure → honest FAILED run, never fake data.
        clearTimeout(timeoutHandle)
        const msg = scrapeErr instanceof ScrapeBlockedError
          ? String(scrapeErr.message)
          : `Scrape failed: ${String((scrapeErr as Error).message).slice(0, 200)}`
        await prisma.run.update({
          where: { id: runId },
          data: { status: 'FAILED', finishedAt: new Date(), errorMessage: msg },
        })
        activeRunIds.delete(runId)
        throw scrapeErr
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
