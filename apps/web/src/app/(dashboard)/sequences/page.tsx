'use client'
import { HelpTip } from "@/components/ui/HelpTip";

import { useState, useEffect, useCallback } from 'react'
import {
  GitBranch, Plus, Linkedin, Mail, CheckCircle, Clock, XCircle,
  Pause, Play, Users2, MessageSquare, X, RefreshCw, Edit2, Trash2,
  ChevronDown, ChevronUp, Menu,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sequence {
  id: string
  name: string
  platform: string
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED'
  leadCount: number
  sentCount?: number
  replyCount: number
  openRate?: number
  steps: SequenceStep[]
  leads: SequenceLead[]
}

interface SequenceStep {
  id?: string
  stepNumber?: number
  type: string
  delay?: number
  messageTemplate: string
  day?: number
}

interface SequenceLead {
  id: string
  firstName: string
  lastName: string
  company: string | null
  status: string
  currentStep?: number
  lastStepAt?: string | null
}

interface Lead {
  id: string
  firstName: string
  lastName: string
  company?: string | null
  email?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function platformBadge(platform: string) {
  const map: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    linkedin:  { label: 'LinkedIn', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',     Icon: Linkedin },
    LINKEDIN:  { label: 'LinkedIn', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',     Icon: Linkedin },
    email:     { label: 'Email',    cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20', Icon: Mail },
    EMAIL:     { label: 'Email',    cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20', Icon: Mail },
    MIXED:     { label: 'Mixed',    cls: 'bg-pink-500/10 text-pink-400 border-pink-500/20',      Icon: MessageSquare },
  }
  const p = map[platform] ?? map['email']!
  const Icon = p.Icon
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${p.cls}`}>
      <Icon className="h-2.5 w-2.5" />{p.label}
    </span>
  )
}

function statusBadge(status: string) {
  if (status === 'ACTIVE') return <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3 w-3" />Active</span>
  if (status === 'PAUSED') return <span className="flex items-center gap-1 text-xs text-yellow-400"><Pause className="h-3 w-3" />Paused</span>
  return <span className="flex items-center gap-1 text-xs text-white/30"><Clock className="h-3 w-3" />Draft</span>
}

function leadStatusBadge(status: string) {
  if (status === 'COMPLETED') return <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Completed</span>
  if (status === 'ACTIVE')    return <span className="text-xs text-blue-400 flex items-center gap-1"><Play className="h-3 w-3" />Active</span>
  if (status === 'BOUNCED')   return <span className="text-xs text-red-400 flex items-center gap-1"><XCircle className="h-3 w-3" />Bounced</span>
  return <span className="text-xs text-white/30 flex items-center gap-1"><Clock className="h-3 w-3" />Pending</span>
}

// ─── New Sequence Modal ───────────────────────────────────────────────────────

function NewSequenceModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (name: string, platform: string) => Promise<Sequence | null>
}) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('EMAIL')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const result = await onCreate(name.trim(), platform)
    setSaving(false)
    if (result === null) {
      setError('Failed to create sequence. Please try again.')
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New Sequence</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Sequence name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. VP Engineering Outreach"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Platform</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full px-3 py-2 bg-[#09090b] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
            >
              <option value="EMAIL">Email</option>
              <option value="LINKEDIN">LinkedIn (needs a connected session)</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Creating…' : 'Create Sequence'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Add Leads Modal ──────────────────────────────────────────────────────────

function AddLeadsModal({ sequenceId, onClose, onAdded }: {
  sequenceId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch('/api/leads')
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`)
        return r.json()
      })
      .then(data => setLeads(Array.isArray(data) ? data : (data.leads ?? [])))
      .catch(err => setFetchError(err instanceof Error ? err.message : 'Failed to load leads.'))
      .finally(() => setLoading(false))
  }, [])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function confirmAdd() {
    setAdding(true)
    for (const leadId of Array.from(selected)) {
      await fetch(`/api/sequences/${sequenceId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      }).catch(() => {})
    }
    setAdding(false)
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#09090b] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add Leads</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-violet-400" /></div>
        ) : fetchError ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{fetchError}</p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {leads.length === 0 && <p className="text-sm text-white/30 text-center py-8">No leads found.</p>}
            {leads.map(lead => (
              <label key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(lead.id)}
                  onChange={() => toggle(lead.id)}
                  className="accent-violet-500"
                />
                <div>
                  <p className="text-sm font-medium">{lead.firstName} {lead.lastName}</p>
                  <p className="text-xs text-white/40">{lead.company ?? '—'} {lead.email ? `· ${lead.email}` : ''}</p>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
          <button
            onClick={confirmAdd}
            disabled={selected.size === 0 || adding || !!fetchError}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors"
          >
            {adding ? 'Adding…' : `Add ${selected.size} Lead${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Steps Editor ─────────────────────────────────────────────────────────────

// Steps may arrive as an array (parsed) or a JSON string (legacy / double-encoded).
// Heal both so the editor never crashes on `.map`.
function parseSteps(v: unknown): SequenceStep[] {
  if (Array.isArray(v)) return v as SequenceStep[]
  if (typeof v === 'string') {
    try { let p = JSON.parse(v); if (typeof p === 'string') p = JSON.parse(p); return Array.isArray(p) ? p : [] }
    catch { return [] }
  }
  return []
}

function StepsEditor({ sequence, onSaved }: { sequence: Sequence; onSaved: () => void }) {
  const [steps, setSteps] = useState<SequenceStep[]>(parseSteps(sequence.steps))
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  async function saveSteps(updated: SequenceStep[]) {
    setSaving(true)
    // Send the ARRAY — the API stringifies it once. Sending a pre-stringified
    // value caused double-encoding (steps read back as a string → .map crash).
    await fetch(`/api/sequences/${sequence.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: updated }),
    }).catch(() => {})
    setSaving(false)
    onSaved()
  }

  function addStep() {
    const newSteps = [...steps, { type: 'MESSAGE', delay: 1, messageTemplate: 'Hi {{firstName}}, ' }]
    setSteps(newSteps)
    setEditingIdx(newSteps.length - 1)
  }

  function updateStep(idx: number, field: keyof SequenceStep, value: string | number) {
    const updated = steps.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    setSteps(updated)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white/60">Steps Timeline</h3>
        <div className="flex gap-2">
          <button
            onClick={() => saveSteps(steps)}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}Save Steps
          </button>
          <button
            onClick={addStep}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 rounded-lg transition-colors"
          >
            <Plus className="h-3 w-3" />Add Step
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">{i + 1}</div>
              {i < steps.length - 1 && <div className="w-px flex-1 bg-white/10 mt-1 mb-1 min-h-[12px]" />}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-white/80 capitalize">{step.type}</span>
                <span className="text-xs text-white/30">Delay: {step.delay ?? step.day ?? 0}d</span>
                <button
                  onClick={() => setEditingIdx(editingIdx === i ? null : i)}
                  className="ml-auto text-white/30 hover:text-white transition-colors"
                >
                  {editingIdx === i ? <ChevronUp className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                </button>
              </div>
              {editingIdx === i ? (
                <div className="space-y-2 p-3 bg-white/3 border border-white/10 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Type</label>
                      <select
                        value={step.type}
                        onChange={e => updateStep(i, 'type', e.target.value)}
                        className="w-full px-2 py-1.5 bg-[#09090b] border border-white/10 rounded text-xs text-white focus:outline-none"
                      >
                        <option>MESSAGE</option><option>WAIT</option><option>CONDITION</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Delay (days)</label>
                      <input
                        type="number"
                        value={step.delay ?? step.day ?? 0}
                        onChange={e => updateStep(i, 'delay', Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-[#09090b] border border-white/10 rounded text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Message Template</label>
                    <textarea
                      value={step.messageTemplate}
                      onChange={e => updateStep(i, 'messageTemplate', e.target.value)}
                      rows={3}
                      className="w-full px-2 py-1.5 bg-[#09090b] border border-white/10 rounded text-xs text-white resize-none focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/50 leading-relaxed bg-white/3 border border-white/5 rounded-lg px-3 py-2 line-clamp-2">{step.messageTemplate}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Sequence | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showAddLeads, setShowAddLeads] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const fetchSequences = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch('/api/sequences').then(r => r.json())
      setSequences(Array.isArray(data) ? data : [])
    } catch { setSequences([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchSequences() }, [fetchSequences])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    setDetailLoading(true)
    fetch(`/api/sequences/${selectedId}`)
      .then(r => r.json())
      .then(data => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  const seq = detail ?? sequences.find(s => s.id === selectedId) ?? null

  function selectSequence(id: string) {
    setSelectedId(id)
    setSidebarOpen(false) // close sidebar on mobile after selecting
  }

  async function createSequence(name: string, platform: string): Promise<Sequence | null> {
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, platform }),
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      await fetchSequences()
      if (data.id) setSelectedId(data.id)
      return data
    } catch { return null }
  }

  async function toggleStatus() {
    if (!seq) return
    setTogglingStatus(true)
    const nextStatus = seq.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    try {
      const res = await fetch(`/api/sequences/${seq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      await fetchSequences()
      setSelectedId(seq.id) // re-trigger detail fetch
    } catch (err) {
      showToast(`Failed to update status: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setTogglingStatus(false)
  }

  async function removeLead(leadId: string) {
    if (!seq) return
    if (!window.confirm('Remove this lead from the sequence? Their progress will be lost.')) return
    try {
      const res = await fetch(`/api/sequences/${seq.id}/leads`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      setSelectedId(seq.id)
      showToast('Lead removed.')
    } catch (err) {
      showToast(`Failed to remove lead: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="flex flex-1 min-h-0 relative">
      {toast && <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">{toast}</div>}
      {showNew && <NewSequenceModal onClose={() => setShowNew(false)} onCreate={createSequence} />}
      {showAddLeads && seq && (
        <AddLeadsModal
          sequenceId={seq.id}
          onClose={() => setShowAddLeads(false)}
          onAdded={() => { setSelectedId(seq.id); showToast('Leads added.') }}
        />
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left sidebar */}
      <div className={`
        shrink-0 border-r border-white/10 flex flex-col z-40
        fixed inset-y-0 left-0 w-80 bg-[#09090b] transition-transform duration-200
        sm:relative sm:translate-x-0 sm:w-80 sm:bg-transparent
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
      `}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-violet-400" />Sequences
            <HelpTip text="Sequences send automated, multi-step outreach (email or LinkedIn) to enrolled leads, with delays between steps. Follow-ups stop automatically when someone replies." example="Day 1 intro email → Day 3 follow-up → Day 6 break-up note." />
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />New
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="sm:hidden p-1.5 text-white/30 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-full p-4 border border-white/5 bg-white/[0.02] rounded-xl animate-pulse flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-white/10 rounded"></div>
                    <div className="h-4 w-16 bg-white/10 rounded"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-4 w-16 bg-white/10 rounded-full"></div>
                    <div className="h-4 w-12 bg-white/10 rounded-full"></div>
                    <div className="h-4 w-12 bg-white/10 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : sequences.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/40 text-sm gap-3 p-4 text-center bg-white/[0.02] border border-white/5 m-4 rounded-2xl shadow-inner">
              <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                <GitBranch className="h-6 w-6 text-violet-400" />
              </div>
              <p>No sequences found.</p>
            </div>
          ) : sequences.map(s => (
            <button
              key={s.id}
              onClick={() => selectSequence(s.id)}
              className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/3 transition-colors ${selectedId === s.id ? 'bg-white/5 border-l-2 border-l-violet-500' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium leading-tight">{s.name}</p>
                {statusBadge(s.status)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {platformBadge(s.platform)}
                <span title="Leads enrolled" className="flex items-center gap-1 text-xs text-white/30"><Users2 className="h-3 w-3" />{s.leadCount}</span>
                <span title="Replies received" className="flex items-center gap-1 text-xs text-white/30"><MessageSquare className="h-3 w-3" />{s.replyCount}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto min-w-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-900/10 via-black to-black">
        {!seq || detailLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm gap-4 p-8">
            {detailLoading
              ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-violet-500/80" />
                  <p className="animate-pulse">Loading sequence details...</p>
                </div>
              )
              : <div className="flex flex-col items-center justify-center max-w-sm text-center p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl backdrop-blur-xl">
                  {/* Mobile toggle button shown when no sequence is selected */}
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="sm:hidden flex items-center gap-2 px-3 py-2 border border-white/10 rounded-lg text-xs text-white/50 hover:bg-white/5 transition-colors mb-4"
                  >
                    <Menu className="h-4 w-4" />View Sequences
                  </button>
                  <div className="h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                    <GitBranch className="h-8 w-8 text-violet-400" />
                  </div>
                  <h2 className="text-lg font-medium text-white mb-2">No Sequence Selected</h2>
                  <p className="text-white/40 mb-6 leading-relaxed">Select a sequence from the sidebar to view its performance, edit steps, and manage enrolled leads.</p>
                  <button
                    onClick={() => setShowNew(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-medium text-white transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                  >
                    <Plus className="h-4 w-4" />Create Sequence
                  </button>
                </div>
            }
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {/* Mobile: button to open sidebar */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="sm:hidden mt-1 p-1.5 text-white/30 hover:text-white transition-colors"
                  title="View all sequences"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-semibold">{seq.name}</h2>
                    {platformBadge(seq.platform)}
                    {statusBadge(seq.status)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleStatus}
                  disabled={togglingStatus}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${seq.status === 'ACTIVE' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20' : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'}`}
                >
                  {togglingStatus ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : seq.status === 'ACTIVE' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {seq.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={() => setShowAddLeads(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors"
                >
                  <Users2 className="h-3.5 w-3.5" />Add Leads
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Lead Count',  value: seq.leadCount ?? 0 },
                { label: 'Sent',        value: seq.sentCount ?? 0 },
                { label: 'Replies',     value: seq.replyCount ?? 0 },
                { label: 'Open Rate',   value: seq.openRate != null ? `${seq.openRate}%` : '—' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/3 border border-white/10 rounded-xl p-4">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Steps timeline */}
            <StepsEditor sequence={seq} onSaved={() => setSelectedId(seq.id)} />

            {/* Enrolled leads table */}
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-3">Enrolled Leads</h3>
              {!seq.leads || seq.leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white/[0.02] border border-white/5 rounded-2xl shadow-inner">
                  <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-3">
                    <Users2 className="h-6 w-6 text-violet-400" />
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1">No leads enrolled</h3>
                  <p className="text-xs text-white/40 mb-4 max-w-[250px] leading-relaxed">Add leads to this sequence to start your automated outreach.</p>
                  <button
                    onClick={() => setShowAddLeads(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded-xl text-sm font-medium text-violet-300 transition-colors"
                  >
                    <Plus className="h-4 w-4" />Add Leads
                  </button>
                </div>
              ) : (
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 text-xs">
                        <th className="text-left px-4 py-2 font-medium">Name</th>
                        <th className="text-left px-4 py-2 font-medium">Company</th>
                        <th className="text-left px-4 py-2 font-medium">Status</th>
                        <th className="text-left px-4 py-2 font-medium">Step</th>
                        <th className="text-left px-4 py-2 font-medium">Last Step At</th>
                        <th className="px-4 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {seq.leads.map(lead => (
                        <tr key={lead.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-3 font-medium">{lead.firstName} {lead.lastName}</td>
                          <td className="px-4 py-3 text-white/50 text-xs">{lead.company ?? '—'}</td>
                          <td className="px-4 py-3">{leadStatusBadge(lead.status)}</td>
                          <td className="px-4 py-3 text-white/50 text-xs">{lead.currentStep ?? '—'}</td>
                          <td className="px-4 py-3 text-white/40 text-xs">
                            {lead.lastStepAt ? new Date(lead.lastStepAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => removeLead(lead.id)}
                              className="p-1.5 text-red-400/50 hover:text-red-400 transition-colors"
                              title="Remove lead"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
