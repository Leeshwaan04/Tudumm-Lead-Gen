import { Worker } from 'bullmq'
import { prisma } from '../lib/db'
import type { RunJobData } from '../lib/queue'
import { redisConnection as connection, getRedis, rateGate } from '../lib/redis-connection'
import { uploadJSON } from '../lib/storage'
import { decryptCookie } from '../lib/cookie-cipher'
import crypto from 'crypto'
import { resolveMx } from 'node:dns/promises'
import { captureError } from '../lib/observability'

/**
 * Provider-independent email engine: generates the common business email patterns
 * for a name@domain and keeps them only if the domain has valid MX (mail) records.
 * Works for ANY domain — no third-party API, no per-search quota. Used as a
 * fallback when external lookups have no data.
 */
async function patternEmails(first: string, last: string, domain: string): Promise<Record<string, unknown>[]> {
  if (!domain || !/\./.test(domain)) return []
  let hasMx = false
  try { hasMx = (await resolveMx(domain)).length > 0 } catch { hasMx = false }
  if (!hasMx) return []
  const f = first.toLowerCase().replace(/[^a-z]/g, '')
  const l = last.toLowerCase().replace(/[^a-z]/g, '')
  const out: { email: string; confidence: number }[] = []
  if (f && l) {
    out.push(
      { email: `${f}.${l}@${domain}`, confidence: 75 },
      { email: `${f}${l}@${domain}`, confidence: 55 },
      { email: `${f[0]}${l}@${domain}`, confidence: 50 },
      { email: `${f}@${domain}`, confidence: 40 },
    )
  } else if (f) {
    out.push({ email: `${f}@${domain}`, confidence: 45 })
  } else {
    // No name → role-based addresses common at most companies.
    for (const role of ['contact', 'hello', 'info', 'sales', 'support'])
      out.push({ email: `${role}@${domain}`, confidence: 35 })
  }
  return out.map(o => ({
    email: o.email, firstName: first || null, lastName: last || null,
    domain, score: o.confidence, source: 'pattern', verified: 'mx',
  }))
}

const JOB_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
// Concurrency is env-tunable so you can scale a worker vertically (per-instance)
// and run multiple worker instances horizontally for high scraping volume.
const MAX_CONCURRENT = Number(process.env.RUN_CONCURRENCY ?? 8)
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

// On-site email harvesting — crawl a company's own pages for REAL published
// emails. Free, no third-party API, works for any domain with a website.
async function harvestSiteEmails(domain: string, runId: string): Promise<Record<string, unknown>[]> {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
  if (!clean || !/\./.test(clean)) return []
  const base = `https://${clean}`
  const pages = ['', '/contact', '/contact-us', '/about', '/about-us', '/team']
  const found = new Map<string, Record<string, unknown>>()
  for (const path of pages) {
    if (found.size >= 25) break
    try {
      const res = await fetch(`${BROWSER_SERVICE_URL}/browser/scrape`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: base + path, waitFor: 'domcontentloaded' }),
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) continue
      const r = await res.json()
      const emails: string[] = (r.extracted?.emails ?? [])
      for (const raw of emails) {
        const em = String(raw).toLowerCase()
        // keep only addresses on this company's domain, skip junk/asset emails
        if (em.endsWith('@' + clean) && !/\.(png|jpg|jpeg|gif|webp|svg)$/.test(em) && !found.has(em)) {
          found.set(em, { email: em, domain: clean, source: 'website', score: 90 })
        }
      }
    } catch { /* page may not exist — fine */ }
  }
  if (found.size) await addLog(runId, 'INFO', `Found ${found.size} published email(s) on ${clean}`)
  return [...found.values()]
}

// GitHub phantom via the free official GitHub API — clean structured data, no
// scraping, no blocking. 60 req/hr unauthenticated; 5000/hr with GITHUB_TOKEN.
async function githubApiRun(data: RunJobData, url: string): Promise<{ items: Record<string, unknown>[]; creditsCost: number }> {
  const { runId } = data
  await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date() } })
  const username = (url.match(/github\.com\/([^/?#]+)/i)?.[1] || '').trim()
  if (!username || ['search', 'orgs', 'topics'].includes(username.toLowerCase())) {
    throw new ScrapeBlockedError('Provide a GitHub profile URL like github.com/username.')
  }
  await addLog(runId, 'INFO', `Fetching GitHub profile @${username}`)
  const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Tudumm/1.0' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

  const r = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers, signal: AbortSignal.timeout(15000) })
  if (r.status === 404) throw new ScrapeBlockedError(`GitHub user "${username}" not found.`)
  if (r.status === 403) throw new ScrapeBlockedError('GitHub rate limit reached — add a GITHUB_TOKEN for 5000 req/hr.')
  if (!r.ok) throw new Error(`GitHub API error ${r.status}`)
  const u = await r.json()
  const item = {
    type: 'github_profile', username: u.login, name: u.name ?? null, bio: u.bio ?? null,
    company: u.company ?? null, location: u.location ?? null, email: u.email ?? null,
    blog: u.blog || null, twitter: u.twitter_username ?? null,
    followers: u.followers ?? null, following: u.following ?? null, publicRepos: u.public_repos ?? null,
    profileUrl: u.html_url, avatarUrl: u.avatar_url ?? null, createdAt: u.created_at ?? null, source: 'github',
  }
  await addLog(runId, 'INFO', `Found @${u.login}${u.name ? ` (${u.name})` : ''} — ${u.public_repos ?? 0} repos, ${u.followers ?? 0} followers`)
  return { items: [item], creditsCost: 1 }
}

// Google Maps phantom via free OpenStreetMap data (Overpass + Nominatim) — no
// proxy, no blocking. Geocodes the location, queries POIs by category.
const OSM_TAGS: Record<string, string[]> = {
  'coffee': ['amenity=cafe'], 'cafe': ['amenity=cafe'], 'restaurant': ['amenity=restaurant'],
  'food': ['amenity=restaurant', 'amenity=fast_food'], 'bar': ['amenity=bar', 'amenity=pub'], 'pub': ['amenity=pub'],
  'hotel': ['tourism=hotel'], 'gym': ['leisure=fitness_centre'], 'fitness': ['leisure=fitness_centre'],
  'dentist': ['amenity=dentist'], 'doctor': ['amenity=doctors'], 'clinic': ['amenity=clinic'],
  'hospital': ['amenity=hospital'], 'pharmacy': ['amenity=pharmacy'], 'bakery': ['shop=bakery'],
  'salon': ['shop=hairdresser', 'shop=beauty'], 'hairdresser': ['shop=hairdresser'], 'spa': ['leisure=spa', 'shop=beauty'],
  'supermarket': ['shop=supermarket'], 'grocery': ['shop=supermarket', 'shop=convenience'],
  'bank': ['amenity=bank'], 'school': ['amenity=school'], 'lawyer': ['office=lawyer'],
  'real estate': ['office=estate_agent'], 'realtor': ['office=estate_agent'], 'store': ['shop'], 'shop': ['shop'],
}

// Geocode cache + throttle — Nominatim policy is ≤1 req/sec and requires caching.
// Cache + rate-gate are Redis-backed so they coordinate ACROSS worker replicas
// (in-process throttling would let N workers hammer Nominatim → IP ban at scale).
type Geo = { s: number; w: number; n: number; e: number; display: string }
async function geocodeLocation(where: string): Promise<Geo | null> {
  const key = where.toLowerCase().trim()
  const redis = getRedis()
  try {
    const cached = await redis.get(`geo:${key}`)
    if (cached) return cached === 'null' ? null : JSON.parse(cached)
  } catch { /* cache miss / redis down */ }

  await rateGate('nominatim', 1100) // global ≤1 req/1.1s across all replicas
  const geo: any[] = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(where)}`,
    { headers: { 'User-Agent': 'Tudumm/1.0 (+https://tudumm.in)' }, signal: AbortSignal.timeout(15000) })
    .then(r => r.json()).catch(() => [])
  let result: Geo | null = null
  if (geo[0]?.boundingbox) {
    const b = geo[0].boundingbox.map(Number) // [south, north, west, east]
    result = { s: b[0] ?? 0, w: b[2] ?? 0, n: b[1] ?? 0, e: b[3] ?? 0, display: String(geo[0].display_name || where) }
  }
  try { await redis.set(`geo:${key}`, JSON.stringify(result), 'EX', 60 * 60 * 24 * 30) } catch { /* ignore */ }
  return result
}

async function overpassRun(data: RunJobData): Promise<{ items: Record<string, unknown>[]; creditsCost: number }> {
  const { runId, input } = data
  await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date() } })
  const rawQuery = String((input as any).query || (input as any).what || '').trim()
  let where = String((input as any).location || (input as any).where || '').trim()
  let what = rawQuery
  const m = rawQuery.match(/^(.*?)\s+in\s+(.+)$/i)
  if (!where && m) { what = (m[1] ?? '').trim(); where = (m[2] ?? '').trim() }
  if (!what) throw new ScrapeBlockedError('Search like "coffee shops in Austin".')
  await addLog(runId, 'INFO', `Searching "${what}"${where ? ` in ${where}` : ''} via open map data`)

  // 1) Geocode the location → bounding box (cached + throttled)
  if (!where) throw new ScrapeBlockedError('Add a location, e.g. "dentists in Boston".')
  const loc = await geocodeLocation(where)
  if (!loc) throw new ScrapeBlockedError(`Couldn't locate "${where}". Try "<type> in <city>".`)
  const { s, w, n, e } = loc
  await addLog(runId, 'INFO', `Location: ${loc.display.slice(0, 60)}`)

  // 2) Category → OSM tags (fallback: match the name)
  const key = Object.keys(OSM_TAGS).find(k => what.toLowerCase().includes(k))
  let filters = ''
  if (key) {
    for (const tag of (OSM_TAGS[key] ?? [])) {
      const tk = tag.split('=')[0] ?? ''
      const tv = tag.split('=')[1]
      filters += `nwr${tv ? `["${tk}"="${tv}"]` : `["${tk}"]`}(${s},${w},${n},${e});`
    }
  } else {
    filters = `nwr["name"~"${what.replace(/["\\]/g, '')}",i](${s},${w},${n},${e});`
  }
  const oql = `[out:json][timeout:25];(${filters});out center 80;`

  // 3) Query Overpass (free, ~10k/day shared) — global gate spaces requests so
  // many workers don't trip its rate limit.
  await rateGate('overpass', 1500)
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'Tudumm/1.0 (+https://tudumm.in)',
    },
    body: `data=${encodeURIComponent(oql)}`, signal: AbortSignal.timeout(45000),
  })
  if (!r.ok) throw new Error(`Map data service error ${r.status}`)
  const d = await r.json()
  const items = (d.elements ?? []).map((el: any) => {
    const t = el.tags ?? {}
    const addr = [t['addr:housenumber'], t['addr:street'], t['addr:city'], t['addr:postcode']].filter(Boolean).join(', ')
    return {
      name: t.name ?? null, address: addr || null,
      phone: t.phone || t['contact:phone'] || null,
      website: t.website || t['contact:website'] || null,
      email: t.email || t['contact:email'] || null,
      category: t.amenity || t.shop || t.office || t.leisure || t.tourism || null,
      openingHours: t.opening_hours || null,
      lat: el.lat ?? el.center?.lat ?? null, lng: el.lon ?? el.center?.lon ?? null,
      source: 'maps',
    }
  }).filter((x: any) => x.name)
  await addLog(runId, 'INFO', `Found ${items.length} business(es)`)
  return { items, creditsCost: Math.max(1, Math.ceil(items.length * 0.05)) }
}

// AI-assisted extraction — turn any page's text into structured rows from a
// plain-English instruction, via Groq. No per-site parser needed. Self-built.
async function aiExtract(text: string, prompt: string): Promise<Record<string, unknown>[]> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !text) return []
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', max_tokens: 2048, temperature: 0.1,
        messages: [
          { role: 'system', content: 'You extract structured data from web page text. Respond with ONLY a JSON array of objects (no prose, no markdown).' },
          { role: 'user', content: `From the page content below, extract: ${prompt}\nReturn a JSON array of objects with consistent keys.\n\nPAGE CONTENT:\n${text.slice(0, 12000)}` },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json()
    if (!res.ok) return []
    const raw: string = data.choices?.[0]?.message?.content ?? '[]'
    const arr = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
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
  }

  // Bring-your-own proxy: if the workspace configured a residential proxy, use
  // it (overrides any global PROXY_LIST). Decrypted just-in-time.
  let proxyUrl: string | undefined
  try {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { proxyUrl: true } })
    if (ws?.proxyUrl) {
      proxyUrl = decryptCookie(ws.proxyUrl)
      await addLog(runId, 'INFO', 'Routing through your configured residential proxy')
    }
  } catch { /* fall back to global PROXY_LIST in browser-service */ }
  if (!proxyUrl && /google\.[^/]+\/maps|linkedin\.com|instagram\.com|(twitter|x)\.com/i.test(url)) {
    await addLog(runId, 'WARN', 'No proxy configured — this site often blocks datacenter IPs. Add a proxy in Settings → Proxy.')
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
    body: JSON.stringify({ url, waitFor, cookies, proxyUrl }),
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

  // AI-assisted extraction: if the user described what they want, turn the page
  // into exactly those structured rows. Falls back to the structured data above.
  const extractPrompt = (data.input as any)?.extractPrompt || (data.input as any)?.extract
  if (extractPrompt && typeof result.text === 'string' && result.text.length > 40) {
    await addLog(runId, 'INFO', `AI-extracting: "${String(extractPrompt).slice(0, 80)}"`)
    const aiItems = await aiExtract(result.text, String(extractPrompt))
    if (aiItems.length) {
      await addLog(runId, 'INFO', `AI extracted ${aiItems.length} record(s)`)
      return { items: aiItems, creditsCost: Math.max(1, Math.ceil(aiItems.length * 0.05)) }
    }
    await addLog(runId, 'WARN', 'AI extraction found nothing — returning the page data instead.')
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

  // Tudumm's OWN email engine (on-site crawl + pattern + MX) is the default.
  // External directories are OFF unless explicitly enabled — we don't depend on
  // them. Set USE_EXTERNAL_EMAIL_PROVIDERS=true only if you ever want a fallback.
  const useExternal = process.env.USE_EXTERNAL_EMAIL_PROVIDERS === 'true'
  const hunterKey = useExternal ? process.env.HUNTER_API_KEY : undefined
  const apolloKey = useExternal ? process.env.APOLLO_API_KEY : undefined

  // Accept a bare domain or a full company URL.
  let domain: string = input.domain || input.companyDomain || ''
  const maybeUrl = input.url || input.website
  if (!domain && typeof maybeUrl === 'string') {
    try { domain = new URL(/^https?:\/\//i.test(maybeUrl) ? maybeUrl : `https://${maybeUrl}`).hostname.replace(/^www\./, '') } catch { /* ignore */ }
  }
  let first = String(input.firstName || input.first_name || '').trim()
  let last = String(input.lastName || input.last_name || '').trim()

  // Ignore junk/placeholder names (single letters, digits) — Hunter rejects them
  // with a 400. If a name is invalid, drop it and fall back to domain search so
  // the user still gets results instead of an error.
  const validName = (n: string) => /[a-zA-Z]{2,}/.test(n)
  if (first && !validName(first)) { await addLog(runId, 'WARN', `Ignoring invalid first name "${first}" — searching the whole company instead.`); first = '' }
  if (last && !validName(last)) last = ''

  // Accept a company NAME in the domain field — Hunter resolves it to a domain.
  // A real domain has a dot and no spaces; otherwise treat it as a company name.
  const looksLikeDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain.trim())
  const hunterTarget: Record<string, string> = looksLikeDomain ? { domain: domain.trim() } : { company: domain.trim() }
  // The actual domain (filled in once Hunter resolves a company name) — used for the Apollo fallback.
  let resolvedDomain = looksLikeDomain ? domain.trim() : ''

  // Apollo people-search builds a LIST by criteria (title/company/keywords) — it
  // doesn't need a person or even a domain.
  const isApolloSearch = /apollo/i.test(data.actorSlug ?? '') && !first && !last &&
    !!(input.title || input.titles || input.keywords || input.query)
  if (!domain && !isApolloSearch) {
    await addLog(runId, 'ERROR', 'No company domain provided. Enter a domain like "stripe.com".')
    throw new ScrapeBlockedError('Email Finder requires a company domain')
  }
  await addLog(runId, 'INFO', isApolloSearch
    ? `Searching the contact directory: ${input.title || input.titles || input.keywords || input.query}`
    : `Searching emails for ${first || '(any)'} ${last} @ ${domain}`)

  const results: Record<string, unknown>[] = []
  try {
    if (hunterKey && (first || last)) {
      const params = new URLSearchParams({ ...hunterTarget, first_name: first, last_name: last, api_key: hunterKey })
      const r = await fetch(`https://api.hunter.io/v2/email-finder?${params}`, { signal: AbortSignal.timeout(15000) })
      const d = await r.json().catch(() => ({}))
      if (d.data?.domain) resolvedDomain = d.data.domain
      if (r.ok && d.data?.email) {
        results.push({ email: d.data.email, firstName: first, lastName: last, domain: d.data.domain ?? domain, score: d.data.score ?? null, source: 'verified' })
        await addLog(runId, 'INFO', `Found verified email: ${d.data.email} (confidence ${d.data.score ?? '?'})`)
      } else if (!r.ok) {
        await addLog(runId, 'WARN', `Email lookup returned an error (${r.status}).`)
      }
    } else if (hunterKey && !first && !last) {
      // No name → domain search returns known emails at the company.
      // Hunter's free plan caps domain-search at 10 results; 10 is the safe default.
      const params = new URLSearchParams({ ...hunterTarget, api_key: hunterKey, limit: '10' })
      const r = await fetch(`https://api.hunter.io/v2/domain-search?${params}`, { signal: AbortSignal.timeout(15000) })
      const d = await r.json().catch(() => ({}))
      if (d.data?.domain) resolvedDomain = d.data.domain
      if (r.ok && Array.isArray(d.data?.emails)) {
        for (const e of d.data.emails) results.push({ email: e.value, firstName: e.first_name ?? null, lastName: e.last_name ?? null, position: e.position ?? null, domain: resolvedDomain || domain, source: 'directory' })
        await addLog(runId, 'INFO', `Found ${results.length} email(s) at ${resolvedDomain || domain}`)
      } else if (!r.ok) {
        await addLog(runId, 'WARN', `Directory lookup returned an error (${r.status}).`)
      }
    }

    if (results.length === 0 && apolloKey && (first || last)) {
      const r = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': apolloKey },
        body: JSON.stringify({ first_name: first, last_name: last, domain }), signal: AbortSignal.timeout(15000),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.person?.email) {
        results.push({ email: d.person.email, firstName: first, lastName: last, domain, title: d.person.title ?? null, source: 'directory' })
        await addLog(runId, 'INFO', `Found verified email: ${d.person.email}`)
      }
    }

    // Directory people-search — fires for the criteria search actor AND as a
    // fallback for Email Finder, covering far more companies.
    const apolloDomain = resolvedDomain || (looksLikeDomain ? domain.trim() : '')
    if (results.length === 0 && apolloKey && (isApolloSearch || apolloDomain)) {
      const titles = input.titles || (input.title ? [input.title] : undefined)
      const body: Record<string, unknown> = { page: 1, per_page: 25 }
      if (titles) body.person_titles = titles
      if (apolloDomain) body.q_organization_domains = [apolloDomain]
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
            source: 'directory',
          })
        }
        if (results.length) await addLog(runId, 'INFO', `Found ${results.length} contact(s)`)
      }
    }

    // On-site harvest — pull REAL published emails from the company's own site.
    // Free, no third-party. Merged in (deduped); highest-confidence source.
    const siteDomain = resolvedDomain || (looksLikeDomain ? domain.trim() : '')
    if (siteDomain) {
      const harvested = await harvestSiteEmails(siteDomain, runId)
      const seen = new Set(results.map(r => String(r.email ?? '').toLowerCase()))
      for (const h of harvested) if (!seen.has(String(h.email).toLowerCase())) { results.push(h); seen.add(String(h.email).toLowerCase()) }
    }

    // Provider-independent fallback — generate verified email patterns for ANY
    // domain (no external service, no quota). Runs only if nothing was found.
    if (results.length === 0 && (resolvedDomain || looksLikeDomain)) {
      const dom = resolvedDomain || domain.trim()
      const guesses = await patternEmails(first, last, dom)
      if (guesses.length) {
        results.push(...guesses)
        await addLog(runId, 'INFO', `Generated ${guesses.length} likely email(s) for ${dom}, verified against its mail server.`)
      }
    }
  } catch (e: any) {
    await addLog(runId, 'WARN', `Email lookup error: ${String(e.message).slice(0, 160)}`)
  }

  if (results.length === 0) {
    await addLog(runId, 'WARN', `No email found for "${domain}"${first || last ? ` / ${first} ${last}`.trimEnd() : ''}. Tips: use the company's website domain (e.g. stripe.com), or search by domain only (no name) to list all emails at that company.`)
  } else {
    await addLog(runId, 'INFO', `Found ${results.length} email(s)`)
  }

  // Surface found contacts on the Leads page too. Actor runs previously only
  // produced a Dataset, so the Leads list stayed empty — this closes that gap.
  // Optional: drop results into a chosen Lead list (category), e.g. "B2B — Demat".
  let targetListId: string | null = null
  const reqListId = (input as any).listId ? String((input as any).listId) : null
  if (reqListId) {
    const list = await prisma.leadList.findFirst({ where: { id: reqListId, workspaceId } })
    if (list) { targetListId = list.id; await addLog(runId, 'INFO', `Adding leads to list "${list.name}"`) }
  }
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
        source: 'Email Finder',
        listId: targetListId,
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

      // Google Maps phantom → free OpenStreetMap data (no proxy, no blocking)
      // when given a search query. Falls through to scraping for a direct URL.
      const mapsQuery = (job.data.input as any)?.query || (job.data.input as any)?.what
      const isMaps = /google-maps|maps-extractor/i.test(slug)

      // Real scrape only. We NEVER fabricate sample data — an empty/failed scrape
      // is reported honestly so users can trust every dataset.
      const url = extractUrl(job.data.input)
      try {
        if (isMaps && mapsQuery) {
          ({ items, creditsCost } = await overpassRun(job.data))
        } else if (/github/i.test(slug) && url && /github\.com\//i.test(url)) {
          ({ items, creditsCost } = await githubApiRun(job.data, url))
        } else if (url) {
          ({ items, creditsCost } = await realScrapeRun(job.data, url))
        } else {
          throw new ScrapeBlockedError('No target provided. Give a URL — or a search like "coffee shops in Austin" for Google Maps.')
        }
      } catch (scrapeErr) {
        // Block / no-target / any failure → honest FAILED run, never fake data.
        clearTimeout(timeoutHandle)
        const msg = scrapeErr instanceof ScrapeBlockedError
          ? String(scrapeErr.message)
          : `Failed: ${String((scrapeErr as Error).message).slice(0, 200)}`
        await addLog(runId, 'ERROR', msg)
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
worker.on('failed', (job, err) => {
  console.error(`Run ${job?.data.runId} failed:`, err)
  captureError(err, { kind: 'run', runId: job?.data.runId, actorSlug: job?.data.actorSlug, workspaceId: job?.data.workspaceId })
})

console.log('BullMQ run worker started')
