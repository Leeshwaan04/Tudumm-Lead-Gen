'use client'
import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { CreditBalanceCard, StatCard } from '@/components/dashboard/CreditBalanceCard'
import { UsageChart } from '@/components/dashboard/UsageChart'
import { Button } from '@/components/ui/button'
import {
  Play, Plus, Zap, Globe2, Cpu, Activity, Loader2, X, ChevronRight,
  Terminal, Clock, CheckCircle2, AlertCircle, BarChart2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Run, UsageDataPoint } from '@/types'

function toRun(r: any): Run {
  return {
    id: r.id,
    actorId: r.actorId,
    actorName: r.actor?.name ?? r.actorId,
    status: r.status?.toLowerCase() as any,
    startedAt: r.startedAt ?? r.createdAt,
    finishedAt: r.finishedAt,
    durationMs: r.durationMs,
    creditsUsed: r.creditsCost ?? 0,
    itemsScraped: r.output ? (() => { try { return JSON.parse(r.output)?.itemsScraped } catch { return undefined } })() : undefined,
    inputPayload: {},
  }
}

// ── Skeleton helpers ─────────────────────────────────────────────────────────
function PulseSkeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ''}`} />
}

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121214] p-5 space-y-3">
      <PulseSkeleton className="h-4 w-24" />
      <PulseSkeleton className="h-8 w-32" />
      <PulseSkeleton className="h-3 w-20" />
    </div>
  )
}

// ── Quick Run Modal ──────────────────────────────────────────────────────────
function QuickRunModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [actorId, setActorId] = useState('')
  const [input, setInput] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: actors = [] } = useQuery<any[]>({
    queryKey: ['actors'],
    queryFn: () => fetch('/api/actors').then(r => r.json()),
  })

  async function submit() {
    if (!actorId) { setError('Please select an actor'); return }
    let parsedInput: any = {}
    try { parsedInput = JSON.parse(input) } catch { setError('Input must be valid JSON'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/runs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId, input: parsedInput }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      qc.invalidateQueries({ queryKey: ['runs'] })
      setSuccess(true)
      setTimeout(onClose, 1200)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#121214] border border-white/10 rounded-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-400" /> Quick Run
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Select Actor</label>
            <select
              value={actorId}
              onChange={e => setActorId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white"
            >
              <option value="">— choose an actor —</option>
              {actors.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Input JSON</label>
            <textarea
              rows={4}
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 resize-none text-white"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {success && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Run enqueued!</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {loading ? 'Enqueueing…' : 'Run'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Logs Drawer ──────────────────────────────────────────────────────────────
function LogsDrawer({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ['run-logs', runId],
    queryFn: () => fetch(`/api/runs/${runId}/logs`).then(r => r.json()),
    refetchInterval: 3000,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-[#0d0d0f] border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold flex items-center gap-2">
            <Terminal className="h-4 w-4 text-violet-400" /> Run Logs
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
          {isLoading ? (
            <div className="flex items-center gap-2 text-white/30"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading logs…</div>
          ) : logs.length === 0 ? (
            <p className="text-white/30">No logs available.</p>
          ) : (
            logs.map((log: any, i: number) => (
              <div key={log.id ?? i} className="flex gap-3">
                <span className="text-white/20 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`${log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-yellow-400' : 'text-white/70'}`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Chart Empty State ────────────────────────────────────────────────────────
function ChartEmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
        <BarChart2 className="h-6 w-6 text-white/20" />
      </div>
      <div>
        <p className="text-sm text-white/40 font-medium">No runs yet — start an actor to see activity</p>
        <p className="text-xs text-white/20 mt-1">Charts will appear after your first run completes</p>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [showQuickRun, setShowQuickRun] = useState(false)
  const [logsRunId, setLogsRunId] = useState<string | null>(null)

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => fetch('/api/workspace').then(r => r.json()),
  })

  const { data: runsRaw, isLoading: runsLoading } = useQuery({
    queryKey: ['runs'],
    queryFn: () => fetch('/api/runs').then(r => r.json()),
    refetchInterval: 10000,
  })

  const { data: usageRaw, isLoading: usageLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: () => fetch('/api/usage').then(r => r.json()),
  })

  const runs: Run[] = Array.isArray(runsRaw) ? runsRaw.slice(0, 10).map(toRun) : []

  // Only render the chart when we have at least 2 data points — a single point
  // produces a broken "stuck dot" in Recharts area charts.
  const usageData: UsageDataPoint[] = Array.isArray(usageRaw) ? usageRaw : []
  const hasEnoughChartData = usageData.length >= 2

  const balance = workspace ? {
    remaining: workspace.creditBalance ?? 0,
    used: (workspace.execHoursUsed ?? 0) * 100,
    total: Math.max((workspace.creditBalance ?? 0) + (workspace.execHoursUsed ?? 0) * 100, 50000),
    resetDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    plan: (workspace.plan?.toLowerCase() ?? 'starter') as any,
  } : null

  // Quick actions: navigate directly to the relevant page instead of opening a modal
  const quickActions = [
    { label: 'Scrape LinkedIn Profiles', href: '/linkedin', color: 'blue' },
    { label: 'Instagram Follower Export', href: '/actors', color: 'pink' },
    { label: 'Google Maps Extractor', href: '/actors', color: 'yellow' },
  ]

  return (
    <>
      {showQuickRun && <QuickRunModal onClose={() => setShowQuickRun(false)} />}
      {logsRunId && <LogsDrawer runId={logsRunId} onClose={() => setLogsRunId(null)} />}

      <div className="p-6 overflow-y-auto flex-1 space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {wsLoading ? (
                <PulseSkeleton className="h-8 w-56 inline-block" />
              ) : (
                workspace?.name ?? 'Workspace Overview'
              )}
            </h1>
            <p className="text-muted-foreground mt-1">Track your automation performance and credit usage.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/workflows">
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                New Workflow
              </Button>
            </Link>
            <Button
              onClick={() => setShowQuickRun(true)}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              <Zap className="w-4 h-4" />
              Quick Run
            </Button>
          </div>
        </div>

        {/* Stats grid — responsive: 1 → 2 → 4 columns, with loading skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {wsLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              {balance && <CreditBalanceCard balance={balance} />}
              <StatCard
                title="Proxy Traffic"
                value={`${workspace?.proxyGbUsed ?? 0} GB`}
                subtitle={`of ${workspace?.slots ?? 3} GB included`}
                trend={8}
                icon={Globe2}
                iconColor="text-emerald-400"
              />
              <StatCard
                title="Active Slots"
                value={`${workspace?.slots ?? 0}`}
                subtitle="actor slots"
                icon={Activity}
                iconColor="text-blue-400"
              />
              <StatCard
                title="Total Runs"
                value={runsLoading ? '—' : (Array.isArray(runsRaw) ? runsRaw.length : 0).toString()}
                subtitle="all time"
                trend={12}
                icon={Cpu}
                iconColor="text-violet-400"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Usage / Activity chart */}
            <Card className="bg-[#121214] border-[#27272a]">
              <CardHeader>
                <CardTitle>Usage Trends</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {usageLoading ? (
                  // Loading skeleton for chart
                  <div className="h-full flex flex-col justify-end gap-2 pb-2">
                    <div className="flex items-end gap-2 h-full">
                      {[40, 70, 55, 80, 65, 90, 75].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t animate-pulse bg-white/5"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : hasEnoughChartData ? (
                  <UsageChart data={usageData} />
                ) : (
                  <ChartEmptyState />
                )}
              </CardContent>
            </Card>

            {/* Recent Executions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Recent Executions</h2>
                <Link href="/actors">
                  <Button variant="link" className="text-indigo-400 p-0">View all</Button>
                </Link>
              </div>

              {runsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                      <PulseSkeleton className="h-4 w-4 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <PulseSkeleton className="h-3.5 w-40" />
                        <PulseSkeleton className="h-3 w-28" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : runs.length > 0 ? (
                <div className="space-y-2">
                  {runs.map(run => (
                    <button
                      key={run.id}
                      onClick={() => setLogsRunId(run.id)}
                      className="w-full text-left border border-white/10 rounded-xl px-4 py-3 hover:bg-white/[0.03] hover:border-white/20 transition-all group flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {run.status === 'succeeded' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                        ) : run.status === 'failed' ? (
                          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                        ) : (
                          <Loader2 className="h-4 w-4 text-yellow-400 animate-spin shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{run.actorName}</p>
                          <p className="text-xs text-white/40">
                            {new Date(run.startedAt).toLocaleString()} · {run.creditsUsed} credits
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/60 transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/30 text-sm border border-white/10 rounded-xl">
                  No runs yet. Start by running an actor from the Store.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {/* Quick Actions — navigate to the correct page */}
            <Card className="bg-[#121214] border-[#27272a]">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickActions.map(({ label, href, color }) => (
                  <button
                    key={label}
                    onClick={() => router.push(href)}
                    className="w-full text-left flex items-center gap-3 text-sm h-12 border border-[#27272a] hover:bg-[#1c1c1f] rounded-lg px-3 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded bg-${color}-500/10 flex items-center justify-center shrink-0`}>
                      <Play className={`w-4 h-4 text-${color}-500`} />
                    </div>
                    {label}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Plan card */}
            <Card className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border-indigo-500/20">
              <CardContent className="pt-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-indigo-400" />
                </div>
                {wsLoading ? (
                  <div className="space-y-2">
                    <PulseSkeleton className="h-4 w-28" />
                    <PulseSkeleton className="h-3 w-40" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Plan: {workspace?.plan ?? 'STARTER'}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {workspace?.creditBalance?.toLocaleString() ?? 0} credits remaining · {workspace?.aiCredits?.toLocaleString() ?? 0} AI credits
                    </p>
                  </div>
                )}
                <Link href="/billing">
                  <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700">
                    View Plans
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Recent Activity sidebar card */}
            <Card className="bg-[#121214] border-[#27272a]">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-white/40" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {runsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <PulseSkeleton className="h-3 w-3 rounded-full shrink-0" />
                        <PulseSkeleton className="h-3 flex-1" />
                        <PulseSkeleton className="h-3 w-12 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : runs.length === 0 ? (
                  <p className="text-xs text-white/20 text-center py-2">No activity yet</p>
                ) : (
                  runs.slice(0, 5).map(run => (
                    <div key={run.id} className="flex items-center gap-2 text-xs text-white/50">
                      {run.status === 'succeeded' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                      ) : run.status === 'failed' ? (
                        <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />
                      ) : (
                        <Loader2 className="h-3 w-3 text-yellow-400 animate-spin shrink-0" />
                      )}
                      <span className="truncate">{run.actorName}</span>
                      <span className="ml-auto shrink-0 text-white/20">
                        {new Date(run.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
