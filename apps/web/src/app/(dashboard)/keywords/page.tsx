'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Plus, RefreshCw, ExternalLink, Trash2, Eye, Users2, Flame,
  TrendingUp, Radar, Sparkles, Newspaper, Link2,
} from 'lucide-react'
import { HelpTip } from '@/components/ui/HelpTip'

interface TrendingItem {
  id: string
  keyword: string
  keywordEn?: string | null
  newsTitleEn?: string | null
  lang?: string | null
  approxTraffic: number
  trafficLabel: string
  isFinance: boolean
  newsTitle?: string | null
  newsUrl?: string | null
  lastSeenAt: string
}

interface WatchItem {
  id: string
  keyword: string
  category: string
  source: string
  active: boolean
  landingUrl: string | null
  interest: number | null
  interestSource: string | null
  trafficLabel: string | null
  delta: number
  suggestions: string[]
  sparkline: number[]
  lastCheckedAt: string | null
  capturePage: { id: string; slug: string; views: number; submissions: number } | null
}

const PUBLIC_BASE = typeof window !== 'undefined' ? window.location.origin : 'https://tudumm.in'

function fmt(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)} L`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span className="text-white/20 text-xs">collecting…</span>
  const w = 96, h = 24
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(' ')
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke="rgb(167 139 250)" strokeWidth="1.5" />
    </svg>
  )
}

export default function KeywordRadarPage() {
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [lastPolledAt, setLastPolledAt] = useState<string | null>(null)
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [showAll, setShowAll] = useState(false)
  const [inEnglish, setInEnglish] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const showAllRef = useRef(showAll)
  showAllRef.current = showAll

  const load = useCallback(async () => {
    const [t, w] = await Promise.all([
      fetch(`/api/keywords/trending${showAllRef.current ? '?all=1' : ''}`).then(r => (r.ok ? r.json() : { items: [] })),
      fetch('/api/keywords').then(r => (r.ok ? r.json() : [])),
    ])
    setTrending(Array.isArray(t.items) ? t.items : [])
    setLastPolledAt(t.lastPolledAt ?? null)
    setWatchlist(Array.isArray(w) ? w : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 60_000) // minute-basis client refresh
    return () => clearInterval(iv)
  }, [load])

  useEffect(() => { load() }, [showAll, load])

  async function refreshNow() {
    setRefreshing(true)
    await fetch('/api/keywords/refresh', { method: 'POST' }).catch(() => {})
    await load()
    setRefreshing(false)
  }

  async function track(keyword: string, source = 'manual') {
    await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, source }),
    })
    load()
  }

  async function loadSeeds() {
    setRefreshing(true)
    await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: true }),
    })
    await load()
    setRefreshing(false)
  }

  async function createPage(id: string) {
    setBusyId(id)
    await fetch(`/api/keywords/${id}/capture-page`, { method: 'POST' })
    await load()
    setBusyId(null)
  }

  async function remove(id: string) {
    if (!confirm('Stop tracking this keyword? Its capture page and leads are kept.')) return
    await fetch(`/api/keywords/${id}`, { method: 'DELETE' })
    load()
  }

  async function saveLandingUrl(id: string, landingUrl: string) {
    await fetch(`/api/keywords/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landingUrl }),
    })
  }

  // One autocomplete rank step moves the score by ~4; require two to call it a spike.
  const SPIKE_DELTA = 8
  const trackedSet = new Set(watchlist.map(w => w.keyword.toLowerCase()))
  const spiking = watchlist.filter(w => (w.interest ?? 0) > 0 && w.delta >= SPIKE_DELTA)
  const keywordLeads = watchlist.reduce((s, w) => s + (w.capturePage?.submissions ?? 0), 0)
  const keywordViews = watchlist.reduce((s, w) => s + (w.capturePage?.views ?? 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Radar className="h-6 w-6 text-violet-400" /> Keyword Radar
            <HelpTip
              text="Live search-demand intelligence from Google (Trends India + Autocomplete), polled every few minutes. See what people are searching, track high-intent keywords, and convert each one into leads with a capture page."
              example="'upcoming ipo' spikes → Track it → Create capture page → searchers become consented leads."
            />
          </h1>
          <p className="text-sm text-white/50 mt-1">
            What India searches on Google, refreshed on a minute basis — and how each keyword becomes leads.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">Data updated {timeAgo(lastPolledAt)}</span>
          <button
            onClick={refreshNow}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh now
          </button>
        </div>
      </div>

      {/* CBO stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-2xl font-bold text-white">{trending.length}</div>
          <div className="text-xs text-white/40 mt-1">Trending in India (24h{showAll ? '' : ', capital markets'})</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-2xl font-bold text-white">{watchlist.length}</div>
          <div className="text-xs text-white/40 mt-1">Keywords Tracked</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-2xl font-bold text-amber-400 flex items-center gap-1"><Flame className="h-5 w-5" />{spiking.length}</div>
          <div className="text-xs text-white/40 mt-1">Spiking Now</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-2xl font-bold text-emerald-400">{keywordLeads}</div>
          <div className="text-xs text-white/40 mt-1">Leads via Keyword Pages ({keywordViews} views)</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-5 w-5 animate-spin text-violet-400" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Trending now */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-400" /> Trending on Google India — right now
              </h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer">
                  <input type="checkbox" checked={inEnglish} onChange={e => setInEnglish(e.target.checked)} className="accent-violet-500" />
                  English
                </label>
                <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer">
                  <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="accent-violet-500" />
                  Show all topics
                </label>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 max-h-[560px] overflow-y-auto">
              {trending.length === 0 ? (
                <div className="p-8 text-center text-sm text-white/40">
                  No trending data yet — hit <b>Refresh now</b> (or wait for the worker&apos;s next poll).
                </div>
              ) : trending.map(t => (
                <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white truncate">
                        {inEnglish && t.keywordEn ? t.keywordEn : t.keyword}
                      </span>
                      {inEnglish && t.keywordEn && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 shrink-0 truncate max-w-[140px]" title={t.keyword}>
                          {t.lang ? `${t.lang} · ` : ''}{t.keyword}
                        </span>
                      )}
                      {t.approxTraffic > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">
                          {t.trafficLabel || fmt(t.approxTraffic)} searches
                        </span>
                      )}
                      {!t.isFinance && showAll && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 shrink-0">general</span>
                      )}
                    </div>
                    {t.newsTitle && (
                      <a href={t.newsUrl ?? '#'} target="_blank" rel="noreferrer" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 mt-0.5 truncate">
                        <Newspaper className="h-3 w-3 shrink-0" />
                        <span className="truncate">{inEnglish && t.newsTitleEn ? t.newsTitleEn : t.newsTitle}</span>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-white/40">
                    <span>{timeAgo(t.lastSeenAt)}</span>
                    {trackedSet.has(t.keyword.toLowerCase()) ? (
                      <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-400">Tracking</span>
                    ) : (
                      <button onClick={() => track(t.keyword, 'trending')} className="px-2 py-1 rounded bg-violet-600/80 hover:bg-violet-500 text-white text-[11px] transition-colors">
                        + Track
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Watchlist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" /> Watchlist — your lead-gen keywords
              </h2>
              <button onClick={loadSeeds} className="text-xs text-violet-400 hover:text-violet-300">
                Load demat/trading seed pack
              </button>
            </div>

            <form
              onSubmit={e => { e.preventDefault(); if (newKeyword.trim()) { track(newKeyword.trim()); setNewKeyword('') } }}
              className="flex gap-2 mb-3"
            >
              <input
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                placeholder="Track a keyword… e.g. tata capital ipo gmp"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500"
              />
              <button type="submit" className="flex items-center gap-1 px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors">
                <Plus className="h-4 w-4" /> Track
              </button>
            </form>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {watchlist.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-white/40">
                  No keywords tracked yet. Load the seed pack or add a keyword above — the radar snapshots demand for each one every few minutes.
                </div>
              ) : watchlist.map(w => (
                <div key={w.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-white truncate">{w.keyword}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 shrink-0">{w.category}</span>
                      {w.delta >= SPIKE_DELTA && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 flex items-center gap-0.5 shrink-0">
                          <Flame className="h-3 w-3" /> spiking
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Sparkline data={w.sparkline} />
                      <div className="text-right w-20">
                        <div className="text-sm font-semibold text-white">
                          {w.interest === null ? '—' : w.interestSource === 'trending' ? (w.trafficLabel || 'Trending') : `${w.interest}/100`}
                        </div>
                        <div className="text-[10px] text-white/30">
                          {w.interestSource === 'trending' ? 'searches (trending)' : w.interest === null ? 'awaiting poll' : 'demand score'}
                        </div>
                      </div>
                      <button onClick={() => remove(w.id)} className="text-white/30 hover:text-red-400 transition-colors" title="Stop tracking">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {w.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {w.suggestions.slice(0, 6).map(s => (
                        <button key={s} onClick={() => track(s)} title="Track this long-tail" className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 hover:bg-violet-500/25 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-white/5">
                    {w.capturePage ? (
                      <div className="flex items-center gap-3 text-xs">
                        <a href={`${PUBLIC_BASE}/p/${w.capturePage.slug}`} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline flex items-center gap-1">
                          /p/{w.capturePage.slug} <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="flex items-center gap-1 text-white/40"><Eye className="h-3 w-3" />{w.capturePage.views}</span>
                        <span className="flex items-center gap-1 text-emerald-400"><Users2 className="h-3 w-3" />{w.capturePage.submissions} leads</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => createPage(w.id)}
                        disabled={busyId === w.id}
                        className="text-xs px-2.5 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
                      >
                        {busyId === w.id ? 'Creating…' : '⚡ Create capture page'}
                      </button>
                    )}
                    <div className="flex items-center gap-1 flex-1 max-w-[260px]">
                      <Link2 className="h-3 w-3 text-white/30 shrink-0" />
                      <input
                        defaultValue={w.landingUrl ?? ''}
                        onBlur={e => saveLandingUrl(w.id, e.target.value)}
                        placeholder="Map indiabullssecurities.com page…"
                        className="flex-1 bg-transparent border-b border-white/10 focus:border-violet-500 text-[11px] text-white/60 placeholder-white/20 focus:outline-none py-0.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
