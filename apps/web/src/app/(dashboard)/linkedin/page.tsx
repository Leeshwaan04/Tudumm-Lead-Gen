'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Linkedin, Shield, Cookie, Play, RefreshCw, AlertTriangle, CheckCircle,
  Clock, Users, MessageSquare, UserPlus, Search, Zap, Loader2, Trash2, X, Plus,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LinkedInSession {
  id: string; alias: string; email: string
  status: 'ACTIVE' | 'EXPIRED' | 'BANNED'
  dailyLimit: number; dailyUsed: number; riskScore: number
  connections?: number; lastUsedAt?: string; createdAt: string
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  if (status === 'ACTIVE') return <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-400/10 text-green-400">ACTIVE</span>
  if (status === 'EXPIRED') return <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400">EXPIRED</span>
  return <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-400/10 text-red-400">BANNED</span>
}

// ─── Phantom configs ──────────────────────────────────────────────────────────
const phantomDefs = [
  { name: 'Sales Navigator Scraper', icon: Search, desc: 'Export leads from any Sales Navigator search', credits: 5 },
  { name: 'Profile Scraper', icon: Users, desc: 'Extract full profile data from a list of LinkedIn URLs', credits: 2 },
  { name: 'Auto Connect', icon: UserPlus, desc: 'Send personalized connection requests automatically', credits: 8 },
  { name: 'Message Sequence', icon: MessageSquare, desc: 'Automated 3-step follow-up message sequences', credits: 10 },
  { name: 'Post Engager', icon: Zap, desc: 'Auto-like and comment on target accounts\' posts', credits: 3 },
]

const safetyRules = [
  'Max 100 connection requests per day',
  'Random 3–8 second delay between actions',
  'Auto-pause if account flagged as suspicious',
  'Residential proxy routing',
  'Human-like mouse movement patterns',
  'Session cookie refreshed every 24 hours',
]

export default function LinkedInPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<LinkedInSession | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [sessionCookie, setSessionCookie] = useState('')
  const [dailyLimit, setDailyLimit] = useState(100)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3500) }
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const { data: sessions = [], isLoading } = useQuery<LinkedInSession[]>({
    queryKey: ['linkedin-sessions'],
    queryFn: () => fetch('/api/linkedin/sessions').then(r => r.json()),
    refetchInterval: 30000,
  })

  // Auto-select first session
  const displaySess = selected ?? sessions[0] ?? null

  const { data: actors = [] } = useQuery<any[]>({
    queryKey: ['actors'],
    queryFn: () => fetch('/api/actors').then(r => r.json()),
  })

  async function addSession() {
    if (!alias || !email || !sessionCookie) { setSaveError('All fields required'); return }
    setSaving(true); setSaveError('')
    try {
      const res = await fetch('/api/linkedin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias, email, sessionCookie, dailyLimit }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      qc.invalidateQueries({ queryKey: ['linkedin-sessions'] })
      setAlias(''); setEmail(''); setSessionCookie(''); setDailyLimit(100)
      setShowAdd(false)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function refreshSession(id: string) {
    setRefreshingId(id)
    await fetch(`/api/linkedin/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE', dailyUsed: 0 }),
    })
    qc.invalidateQueries({ queryKey: ['linkedin-sessions'] })
    setRefreshingId(null)
  }

  async function testSession(id: string) {
    setTestingId(id)
    try {
      const res = await fetch(`/api/linkedin/sessions/${id}/test`, { method: 'POST' })
      const data = await res.json()
      showToast(data.valid ? `✓ ${data.reason}` : `✗ ${data.reason || data.error || 'Session check failed'}`)
      qc.invalidateQueries({ queryKey: ['linkedin-sessions'] })
    } catch (e: any) {
      showToast(`✗ ${e.message}`)
    } finally {
      setTestingId(null)
    }
  }

  async function deleteSession(id: string) {
    if (!confirm('Remove this session?')) return
    setDeletingId(id)
    await fetch(`/api/linkedin/sessions/${id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['linkedin-sessions'] })
    if (selected?.id === id) setSelected(null)
    setDeletingId(null)
  }

  async function runPhantom(phantomName: string) {
    setRunningId(phantomName)
    try {
      const linkedinActor = actors.find((a: any) =>
        a.slug?.toLowerCase().includes('linkedin') || a.name?.toLowerCase().includes('linkedin')
      )
      if (!linkedinActor) { setToastMsg('No LinkedIn actor found in store'); return }
      await fetch('/api/runs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: linkedinActor.id, input: { phantom: phantomName, sessionId: displaySess?.id } }),
      })
      setToastMsg('Run enqueued!')
    } finally {
      setRunningId(null)
    }
  }

  const riskColor = (score: number) => score < 20 ? 'text-green-400' : score < 50 ? 'text-yellow-400' : 'text-red-400'
  const riskLabel = (score: number) => score < 20 ? 'Low Risk' : score < 50 ? 'Medium Risk' : 'High Risk'
  const usagePct = displaySess ? Math.min(Math.round((displaySess.dailyUsed / displaySess.dailyLimit) * 100), 100) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto">
      {toastMsg && <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">{toastMsg}</div>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#0077B5]/20 border border-[#0077B5]/30 flex items-center justify-center">
            <Linkedin className="h-5 w-5 text-[#0077B5]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">LinkedIn Session Manager</h1>
            <p className="text-sm text-white/40">Manage account sessions, rate limits, and automation safety</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0077B5]/20 border border-[#0077B5]/30 text-[#0077B5] hover:bg-[#0077B5]/30 rounded-lg text-sm transition-colors">
          {showAdd ? <X className="h-4 w-4" /> : <Cookie className="h-4 w-4" />}
          {showAdd ? 'Cancel' : 'Add Session Cookie'}
        </button>
      </div>

      {/* Add Session Form */}
      {showAdd && (
        <div className="border border-[#0077B5]/30 bg-[#0077B5]/5 rounded-xl p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#0077B5]" />
            <h3 className="font-medium">Add LinkedIn Session Cookie</h3>
          </div>
          <p className="text-xs text-white/40">Your cookie is stored encrypted and only used to authenticate browser actions on your behalf.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Session Alias</label>
              <input
                value={alias}
                onChange={e => setAlias(e.target.value)}
                placeholder="e.g. My Sales Account"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-[#0077B5] text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">LinkedIn Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-[#0077B5] text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">li_at Cookie Value</label>
            <textarea
              rows={3}
              value={sessionCookie}
              onChange={e => setSessionCookie(e.target.value)}
              placeholder="Paste your li_at cookie value here…"
              className="w-full px-3 py-2 text-sm font-mono bg-white/5 border border-white/10 rounded-lg outline-none focus:border-[#0077B5] resize-none text-white"
            />
            <p className="text-xs text-white/30 mt-1">DevTools → Application → Cookies → linkedin.com → li_at</p>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Daily Limit</label>
            <input
              type="number"
              value={dailyLimit}
              onChange={e => setDailyLimit(Number(e.target.value))}
              min={10} max={200}
              className="w-32 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-[#0077B5] text-white"
            />
          </div>
          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
            <button onClick={addSession} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#0077B5] hover:bg-[#0077B5]/80 rounded-lg transition-colors disabled:opacity-50">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Saving…' : 'Validate & Save'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Session list */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider">Sessions</h2>
          {isLoading ? (
            <div className="text-xs text-white/30 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-xl p-6 text-center">
              <p className="text-xs text-white/30 mb-3">No sessions yet</p>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 mx-auto text-xs text-[#0077B5] hover:underline">
                <Plus className="h-3 w-3" /> Add first session
              </button>
            </div>
          ) : sessions.map(sess => (
            <div key={sess.id} className="relative group">
              <button
                onClick={() => setSelected(sess)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${displaySess?.id === sess.id ? 'border-[#0077B5]/40 bg-[#0077B5]/8' : 'border-white/10 hover:border-white/20'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium truncate pr-2">{sess.alias}</span>
                  {statusBadge(sess.status)}
                </div>
                <p className="text-xs text-white/40">{sess.email}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                  <span><Clock className="h-3 w-3 inline mr-0.5" />{sess.lastUsedAt ? new Date(sess.lastUsedAt).toLocaleDateString() : 'Never'}</span>
                  {sess.connections && <span>{sess.connections.toLocaleString()} connections</span>}
                </div>
              </button>
              <button
                onClick={() => deleteSession(sess.id)}
                disabled={deletingId === sess.id}
                className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400/50 hover:text-red-400 transition-all disabled:opacity-30"
              >
                {deletingId === sess.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </button>
            </div>
          ))}
        </div>

        {/* Session detail */}
        <div className="col-span-2 space-y-4">
          {displaySess ? (
            <>
              <div className="border border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{displaySess.alias}</h3>
                    <p className="text-sm text-white/40">{displaySess.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => testSession(displaySess.id)}
                      disabled={testingId === displaySess.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 rounded-lg text-sm hover:bg-white/5 transition-colors text-white/60 disabled:opacity-50"
                    >
                      {testingId === displaySess.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <CheckCircle className="h-3.5 w-3.5" />}
                      {testingId === displaySess.id ? 'Testing…' : 'Test Session'}
                    </button>
                    <button
                      onClick={() => refreshSession(displaySess.id)}
                      disabled={refreshingId === displaySess.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 rounded-lg text-sm hover:bg-white/5 transition-colors text-white/60 disabled:opacity-50"
                    >
                      {refreshingId === displaySess.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <RefreshCw className="h-3.5 w-3.5" />}
                      {refreshingId === displaySess.id ? 'Refreshing…' : 'Refresh Cookie'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-white/3 rounded-xl p-3">
                    <p className="text-xs text-white/30 mb-1">Risk Score</p>
                    <p className={`text-2xl font-bold ${riskColor(displaySess.riskScore ?? 0)}`}>{displaySess.riskScore ?? 0}</p>
                    <p className={`text-xs ${riskColor(displaySess.riskScore ?? 0)}`}>{riskLabel(displaySess.riskScore ?? 0)}</p>
                  </div>
                  <div className="bg-white/3 rounded-xl p-3">
                    <p className="text-xs text-white/30 mb-1">Daily Actions</p>
                    <p className="text-2xl font-bold">
                      {displaySess.dailyUsed}<span className="text-sm text-white/30">/{displaySess.dailyLimit}</span>
                    </p>
                    <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${usagePct >= 100 ? 'bg-red-400' : usagePct > 70 ? 'bg-yellow-400' : 'bg-green-400'}`}
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-white/3 rounded-xl p-3">
                    <p className="text-xs text-white/30 mb-1">Status</p>
                    <div className="mt-2">{statusBadge(displaySess.status)}</div>
                  </div>
                </div>

                {usagePct >= 100 && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Daily action limit reached. Automation paused until midnight reset.
                  </div>
                )}
              </div>

              <div className="border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-green-400" />
                  <h3 className="font-medium">Platform Guidelines</h3>
                </div>
                <p className="text-xs text-white/30 mb-3">These are LinkedIn&apos;s recommended usage limits and safety practices. Tudumm enforces them automatically.</p>
                <div className="grid grid-cols-2 gap-2">
                  {safetyRules.map(rule => (
                    <div key={rule} className="flex items-center gap-2 text-xs text-white/50">
                      <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />{rule}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="border border-white/10 rounded-xl p-12 text-center">
              <Linkedin className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/30 text-sm">Add a session to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* LinkedIn Phantoms */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">LinkedIn Phantoms</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {phantomDefs.map(ph => {
            const Icon = ph.icon
            return (
              <div key={ph.name} className="border border-white/10 hover:border-white/20 rounded-xl p-4 transition-colors group">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-9 w-9 rounded-lg bg-[#0077B5]/15 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-[#0077B5]" />
                  </div>
                  <span className="text-xs text-white/30">{ph.credits} credits/run</span>
                </div>
                <p className="font-medium text-sm mb-1">{ph.name}</p>
                <p className="text-xs text-white/40 leading-snug mb-3">{ph.desc}</p>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/30">&nbsp;</div>
                  <button
                    onClick={() => runPhantom(ph.name)}
                    disabled={runningId === ph.name || !displaySess}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-[#0077B5]/20 border border-white/10 hover:border-[#0077B5]/30 rounded-lg text-xs transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                  >
                    {runningId === ph.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {runningId === ph.name ? 'Queuing…' : 'Run'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
