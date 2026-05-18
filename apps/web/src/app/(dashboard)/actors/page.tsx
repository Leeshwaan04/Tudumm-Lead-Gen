'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play, Square, RefreshCw, Terminal, Clock, CheckCircle,
  XCircle, AlertCircle, Search, Loader2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Run {
  id: string
  actorId: string
  actorName: string
  status: string
  startedAt: string
  finishedAt: string | null
  itemsScraped: number
  credits: number
  input?: string
}

interface LogEntry {
  ts: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message?: string
  msg?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  SUCCEEDED: { icon: CheckCircle,  color: 'text-green-400',  label: 'Succeeded' },
  RUNNING:   { icon: RefreshCw,    color: 'text-blue-400',   label: 'Running'   },
  FAILED:    { icon: XCircle,      color: 'text-red-400',    label: 'Failed'    },
  TIMED_OUT: { icon: AlertCircle,  color: 'text-yellow-400', label: 'Timed Out' },
  ABORTED:   { icon: Square,       color: 'text-gray-400',   label: 'Aborted'   },
  CANCELLED: { icon: Square,       color: 'text-gray-400',   label: 'Cancelled' },
}

function duration(start: string, end: string | null) {
  if (!end) return 'Running…'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function mapRun(r: Record<string, unknown>): Run {
  return {
    id: r.id as string,
    actorId: r.actorId as string,
    actorName: ((r.actor as Record<string, unknown>)?.name as string) ?? (r.actorId as string),
    status: r.status as string,
    startedAt: (r.startedAt ?? r.createdAt) as string,
    finishedAt: (r.finishedAt as string | null) ?? null,
    itemsScraped: (() => {
      try { return (JSON.parse((r.output as string) ?? '{}') as Record<string, unknown>)?.itemsScraped as number ?? 0 }
      catch { return 0 }
    })(),
    credits: (r.creditsCost as number) ?? 0,
    input: r.input as string | undefined,
  }
}

// ─── Log Console ─────────────────────────────────────────────────────────────

function LogConsole({ run }: { run: Run }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sinceRef = useRef<string | null>(null)

  const fetchLogs = useCallback(async (since?: string) => {
    try {
      const url = `/api/runs/${run.id}/logs${since ? `?since=${encodeURIComponent(since)}` : ''}`
      const data = await fetch(url).then(r => r.json())
      const entries: LogEntry[] = Array.isArray(data) ? data : []
      if (entries.length > 0) {
        sinceRef.current = entries[entries.length - 1]?.ts ?? null
        setLogs(prev => since ? [...prev, ...entries] : entries)
      } else if (!since) {
        setLogs([])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [run.id])

  useEffect(() => {
    setLogs([])
    setLoading(true)
    sinceRef.current = null
    fetchLogs()
  }, [run.id, fetchLogs])

  useEffect(() => {
    if (run.status !== 'RUNNING') return
    const interval = setInterval(() => fetchLogs(sinceRef.current ?? undefined), 2000)
    return () => clearInterval(interval)
  }, [run.id, run.status, fetchLogs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const levelColor = (level: string) =>
    level === 'ERROR' ? 'text-red-400' : level === 'WARN' ? 'text-yellow-400' : 'text-blue-400'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-black/20 shrink-0">
        <Terminal className="h-4 w-4 text-white/30" />
        <span className="text-xs text-white/40 font-mono">Logs</span>
        {run.status === 'RUNNING' && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />Live
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-black/30">
        {loading && <div className="text-white/20 flex items-center gap-2"><RefreshCw className="h-3 w-3 animate-spin" />Loading logs…</div>}
        {!loading && logs.length === 0 && <div className="text-white/20">No logs available.</div>}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-white/25 shrink-0">{log.ts}</span>
            <span className={`shrink-0 w-10 font-bold ${levelColor(log.level)}`}>{log.level}</span>
            <span className="text-white/75 break-words">{log.message ?? log.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActorsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [aborting, setAborting] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchRuns = useCallback(async () => {
    try {
      const data = await fetch('/api/runs').then(r => r.json())
      const list = (Array.isArray(data) ? data : []).map(mapRun)
      setRuns(list)
      if (!selectedId && list.length > 0) setSelectedId(list[0]?.id ?? null)
    } catch { setRuns([]) }
    setLoading(false)
  }, [selectedId])

  useEffect(() => {
    fetchRuns()
    const interval = setInterval(fetchRuns, 5000)
    return () => clearInterval(interval)
  }, [fetchRuns])

  const filtered = runs.filter(r => {
    const matchSearch = r.actorName.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search)
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  const selected = filtered.find(r => r.id === selectedId) ?? filtered[0] ?? null

  async function abort() {
    if (!selected) return
    setAborting(true)
    await fetch(`/api/runs/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    }).catch(() => {})
    showToast('Run cancelled.')
    setAborting(false)
    fetchRuns()
  }

  async function rerun() {
    if (!selected) return
    setRerunning(true)
    try {
      let input = {}
      try { input = JSON.parse(selected.input ?? '{}') } catch { /* ignore */ }
      await fetch('/api/runs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: selected.actorId, input }),
      })
      showToast('Re-run queued!')
      fetchRuns()
    } catch { showToast('Re-run failed.') }
    setRerunning(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="flex flex-1 min-h-0">
        {toast && <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">{toast}</div>}
        {/* Left panel skeleton */}
        <div className="w-96 shrink-0 border-r border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10 space-y-3">
            <h1 className="text-lg font-semibold">Runs</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
          No runs yet. Start by running an actor from the Store.
        </div>
      </div>
    )
  }

  const StatusIcon = statusConfig[selected.status]?.icon ?? AlertCircle

  return (
    <div className="flex flex-1 min-h-0">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">{toast}</div>
      )}

      {/* Left panel */}
      <div className="w-96 shrink-0 border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10 space-y-3">
          <h1 className="text-lg font-semibold">Runs</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/40" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500"
              placeholder="Search runs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['ALL', 'RUNNING', 'SUCCEEDED', 'FAILED'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${statusFilter === s ? 'bg-violet-600 border-violet-500 text-white' : 'border-white/10 text-white/60 hover:border-white/20'}`}
              >
                {s === 'ALL' ? 'All' : statusConfig[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map(run => {
            const cfg = statusConfig[run.status]
            const Icon = cfg?.icon ?? AlertCircle
            return (
              <button
                key={run.id}
                onClick={() => setSelectedId(run.id)}
                className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition-colors ${selected.id === run.id ? 'bg-white/8 border-l-2 border-l-violet-500' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{run.actorName}</span>
                  <Icon className={`h-3.5 w-3.5 shrink-0 ml-1 ${cfg?.color ?? 'text-gray-400'} ${run.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                </div>
                <div className="text-xs font-mono text-white/30 mb-1 truncate">{run.id}</div>
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{duration(run.startedAt, run.finishedAt)}</span>
                  <span>{run.itemsScraped.toLocaleString()} items</span>
                  <span>{run.credits} credits</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-semibold">{selected.actorName}</h2>
              <span className={`flex items-center gap-1.5 text-sm ${statusConfig[selected.status]?.color ?? 'text-gray-400'}`}>
                <StatusIcon className={`h-4 w-4 ${selected.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                {statusConfig[selected.status]?.label ?? selected.status}
              </span>
            </div>
            <p className="text-sm font-mono text-white/30">{selected.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={rerun}
              disabled={rerunning}
              className="flex items-center gap-2 px-3 py-1.5 border border-white/10 hover:bg-white/5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {rerunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Re-run
            </button>
            {selected.status === 'RUNNING' && (
              <button
                onClick={abort}
                disabled={aborting}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {aborting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                Abort
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-px bg-white/5 border-b border-white/10 shrink-0">
          {[
            { label: 'Items Scraped', value: selected.itemsScraped.toLocaleString() },
            { label: 'Credits Used',  value: selected.credits },
            { label: 'Duration',      value: duration(selected.startedAt, selected.finishedAt) },
            { label: 'Started',       value: new Date(selected.startedAt).toLocaleTimeString() },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0d0d14] p-4">
              <p className="text-xs text-white/40 mb-1">{stat.label}</p>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Log console */}
        <LogConsole run={selected} />
      </div>
    </div>
  )
}
