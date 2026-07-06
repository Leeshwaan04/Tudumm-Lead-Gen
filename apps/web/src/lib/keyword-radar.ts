// Keyword Radar — near-real-time Google search-demand intelligence.
//
// Data sources (all free, no API key):
//  1. Google Trends "Trending Now" RSS (geo=IN) — what India is searching RIGHT NOW,
//     with approximate search volumes ("50,000+"). Updates every few minutes.
//  2. Google Autocomplete (suggestqueries) — live long-tail expansions + a breadth
//     score for watchlist keywords that aren't nationally trending.
//
// Honest limits: Google exposes no per-user or per-second query stream to anyone.
// This module polls the closest public signals on a minute cadence and turns them
// into (a) CBO-visible demand numbers and (b) lead-gen actions (capture pages).

import { prisma } from './db'
import { captureError } from './observability'

// ── Capital-markets vocabulary filter ──────────────────────────────────────
// A trending keyword counts as "finance" if the query or its attached news
// headline matches any of these. Deliberately broad: IPO names and stock
// tickers trend as bare company names, so the news headline matters.
const FINANCE_TERMS = [
  'ipo', 'share', 'stock', 'nifty', 'sensex', 'demat', 'trading', 'trader',
  'mutual fund', 'sebi', 'nse', 'bse', 'dividend', 'etf', 'sip', 'f&o',
  'futures', 'options', 'broker', 'brokerage', 'investment', 'investor',
  'gmp', 'listing', 'allotment', 'buyback', 'bonus share', 'stock split',
  'market cap', 'share price', 'stock price', 'q1 results', 'q2 results',
  'q3 results', 'q4 results', 'quarterly results', 'earnings', 'rbi',
  'repo rate', 'rupee', 'gold price', 'silver price', 'crude', 'zerodha',
  'groww', 'upstox', 'angel one', 'paytm money', 'smallcase', 'portfolio',
  'intraday', 'derivative', 'commodity', 'currency trading', 'bond yield',
]

export function isFinanceKeyword(keyword: string, newsTitle?: string | null): boolean {
  const hay = `${keyword} ${newsTitle ?? ''}`.toLowerCase()
  return FINANCE_TERMS.some(t => hay.includes(t))
}

/** "50,000+" | "1,00,000+" | "2M+" → integer approximation. */
export function parseApproxTraffic(label: string): number {
  const s = (label || '').trim().toUpperCase()
  const m = s.match(/([\d,.]+)\s*(K|M|LAKH|CRORE)?/)
  if (!m || !m[1]) return 0
  const base = parseFloat(m[1].replace(/,/g, ''))
  if (Number.isNaN(base)) return 0
  const mult = m[2] === 'M' ? 1_000_000 : m[2] === 'K' ? 1_000 : m[2] === 'LAKH' ? 100_000 : m[2] === 'CRORE' ? 10_000_000 : 1
  return Math.round(base * mult)
}

// ── Source 1: Google Trends "Trending Now" RSS ─────────────────────────────
export interface TrendingItem {
  keyword: string
  trafficLabel: string
  approxTraffic: number
  newsTitle?: string
  newsUrl?: string
  isFinance: boolean
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" }

function xmlText(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))
  const raw = m?.[1]?.trim()
  if (!raw) return undefined
  return raw.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, e => ENTITIES[e] ?? e)
}

export async function fetchTrendingRss(geo = 'IN'): Promise<TrendingItem[]> {
  const res = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Trends RSS HTTP ${res.status}`)
  const xml = await res.text()
  const items: TrendingItem[] = []
  for (const block of xml.split('<item>').slice(1)) {
    const keyword = xmlText(block, 'title')
    if (!keyword) continue
    const trafficLabel = xmlText(block, 'ht:approx_traffic') ?? ''
    const newsTitle = xmlText(block, 'ht:news_item_title')
    const newsUrl = xmlText(block, 'ht:news_item_url')
    items.push({
      keyword,
      trafficLabel,
      approxTraffic: parseApproxTraffic(trafficLabel),
      newsTitle,
      newsUrl,
      isFinance: isFinanceKeyword(keyword, newsTitle),
    })
  }
  return items
}

// ── Source 2: Google Autocomplete ──────────────────────────────────────────
/** Live suggestions for a seed term — the long-tails people type right now. */
export async function fetchAutocomplete(seed: string, gl = 'IN'): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&gl=${gl}&q=${encodeURIComponent(seed)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Autocomplete HTTP ${res.status}`)
  const data = (await res.json()) as [string, string[]]
  return Array.isArray(data?.[1]) ? data[1] : []
}

// ── Poller (called from the worker scheduler + manual refresh API) ─────────
const SNAPSHOT_RETENTION_DAYS = 30
const WATCHLIST_BATCH = Number(process.env.KEYWORD_RADAR_BATCH ?? 30)

/** Upsert the national trending feed into trending_keywords. */
export async function pollTrendingFeed(geo = 'IN'): Promise<number> {
  const items = await fetchTrendingRss(geo)
  const now = new Date()
  for (const it of items) {
    await prisma.trendingKeyword.upsert({
      where: { geo_keyword: { geo, keyword: it.keyword } },
      update: {
        approxTraffic: it.approxTraffic,
        trafficLabel: it.trafficLabel,
        isFinance: it.isFinance,
        newsTitle: it.newsTitle,
        newsUrl: it.newsUrl,
        lastSeenAt: now,
      },
      create: {
        geo,
        keyword: it.keyword,
        approxTraffic: it.approxTraffic,
        trafficLabel: it.trafficLabel,
        isFinance: it.isFinance,
        newsTitle: it.newsTitle,
        newsUrl: it.newsUrl,
      },
    })
  }
  return items.length
}

/**
 * Snapshot every active tracked keyword across all workspaces.
 * Interest score: national trending approx-traffic when the keyword (or a
 * trending query containing it) is trending; otherwise an autocomplete
 * breadth score (10 pts per live suggestion — 0 means nobody types it).
 */
export async function snapshotWatchlists(): Promise<number> {
  const tracked = await prisma.trackedKeyword.findMany({
    where: { active: true },
    orderBy: { updatedAt: 'asc' }, // round-robin: stalest first
    take: WATCHLIST_BATCH,
  })
  if (tracked.length === 0) return 0

  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000)
  const trendingNow = await prisma.trendingKeyword.findMany({
    where: { lastSeenAt: { gte: cutoff } },
  })

  let count = 0
  for (const kw of tracked) {
    try {
      const lower = kw.keyword.toLowerCase()
      const hit = trendingNow.find(
        t => t.keyword.toLowerCase().includes(lower) || lower.includes(t.keyword.toLowerCase())
      )
      let interest: number
      let source: string
      let suggestions: string[] = []
      if (hit && hit.approxTraffic > 0) {
        interest = hit.approxTraffic
        source = 'trending'
      } else {
        suggestions = await fetchAutocomplete(kw.keyword)
        interest = suggestions.length * 10
        source = 'autocomplete'
      }
      await prisma.keywordSnapshot.create({
        data: {
          keywordId: kw.id,
          interest,
          source,
          meta: JSON.stringify({
            suggestions: suggestions.slice(0, 10),
            trafficLabel: hit?.trafficLabel,
            newsUrl: hit?.newsUrl,
          }),
        },
      })
      // touch updatedAt so round-robin advances
      await prisma.trackedKeyword.update({ where: { id: kw.id }, data: { updatedAt: new Date() } })
      count++
      await new Promise(r => setTimeout(r, 400)) // be polite to suggestqueries
    } catch (err) {
      await captureError(err, { scope: 'keyword-radar', keyword: kw.keyword })
    }
  }

  // Prune old snapshots so the table stays small.
  await prisma.keywordSnapshot.deleteMany({
    where: { capturedAt: { lt: new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 86_400_000) } },
  })
  return count
}

/** One full radar pass: trending feed + watchlist snapshots. */
export async function pollKeywordRadar(): Promise<{ trending: number; snapshots: number }> {
  const trending = await pollTrendingFeed('IN').catch(async err => {
    await captureError(err, { scope: 'keyword-radar', step: 'trending-rss' })
    return 0
  })
  const snapshots = await snapshotWatchlists().catch(async err => {
    await captureError(err, { scope: 'keyword-radar', step: 'watchlist' })
    return 0
  })
  return { trending, snapshots }
}

// ── Seed pack: high-intent demat/trading keywords for India ────────────────
export const SEED_KEYWORDS: { keyword: string; category: string }[] = [
  { keyword: 'open demat account', category: 'account-opening' },
  { keyword: 'free demat account', category: 'account-opening' },
  { keyword: 'demat account kaise khole', category: 'account-opening' },
  { keyword: 'best demat account in india', category: 'account-opening' },
  { keyword: 'lowest brokerage charges', category: 'account-opening' },
  { keyword: 'zero brokerage trading', category: 'account-opening' },
  { keyword: 'best trading app in india', category: 'comparison' },
  { keyword: 'zerodha vs groww', category: 'comparison' },
  { keyword: 'best broker for f&o', category: 'comparison' },
  { keyword: 'discount broker india', category: 'comparison' },
  { keyword: 'upcoming ipo', category: 'ipo' },
  { keyword: 'ipo gmp today', category: 'ipo' },
  { keyword: 'ipo allotment status', category: 'ipo' },
  { keyword: 'how to apply for ipo', category: 'ipo' },
  { keyword: 'how to buy stocks in india', category: 'beginner' },
  { keyword: 'share market for beginners', category: 'beginner' },
  { keyword: 'intraday trading for beginners', category: 'beginner' },
  { keyword: 'what is f&o trading', category: 'beginner' },
  { keyword: 'brokerage calculator', category: 'tools' },
  { keyword: 'sip calculator', category: 'tools' },
  { keyword: 'nifty 50 today', category: 'market-pulse' },
  { keyword: 'sensex today', category: 'market-pulse' },
  { keyword: 'stock market news', category: 'market-pulse' },
  { keyword: 'indiabulls securities', category: 'brand' },
]
