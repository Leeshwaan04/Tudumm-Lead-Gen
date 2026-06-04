'use client'
import { HelpTip } from "@/components/ui/HelpTip";

import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users2, Plus, Upload, Search, CheckCircle, XCircle, AlertTriangle,
  Brain, Mail, Phone, Linkedin, Twitter, Zap, RefreshCw, ChevronRight, X,
  Copy, Check, Loader2, Trash2, MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LeadList { id: string; name: string; leadCount: number; createdAt: string }
interface Lead {
  id: string; firstName: string; lastName: string; fullName?: string
  title: string | null; company: string | null; email: string | null
  emailStatus: 'VERIFIED' | 'RISKY' | 'NOT_FOUND' | null
  phone: string | null; linkedinUrl: string | null; twitterUrl: string | null
  icpScore: number | null; source: string | null; aiSummary: string | null
  outreachAngle: string | null; githubUrl?: string | null; tags?: string[]
}
interface Activity {
  id: string; type: string; note: string | null; createdAt: string
}



// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <p className="text-sm text-white/80">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 text-xs border border-white/10 rounded-lg hover:bg-white/5 text-white/60 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-xs bg-red-600 hover:bg-red-500 rounded-lg text-white transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function icpBadge(score: number | null) {
  if (score === null) return <span className="text-xs text-white/30">—</span>
  const cls = score >= 85 ? 'bg-green-400/10 text-green-400' : score >= 70 ? 'bg-yellow-400/10 text-yellow-400' : 'bg-white/5 text-white/40'
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded-lg ${cls}`}>{score}</span>
}

function emailBadge(status: string | null) {
  if (status === 'VERIFIED') return <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3 w-3" />Verified</span>
  if (status === 'RISKY') return <span className="flex items-center gap-1 text-xs text-yellow-400"><AlertTriangle className="h-3 w-3" />Risky</span>
  return <span className="flex items-center gap-1 text-xs text-white/30"><XCircle className="h-3 w-3" />Not found</span>
}

function initials(lead: Lead) {
  return `${lead.firstName?.[0] ?? ''}${lead.lastName?.[0] ?? ''}`.toUpperCase() || '?'
}

// ─── Sequence Picker Modal ────────────────────────────────────────────────────
function SequenceModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { data: seqs = [] } = useQuery<any[]>({
    queryKey: ['sequences'],
    queryFn: () => fetch('/api/sequences').then(r => r.json()),
  })
  async function addToSeq(seqId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/sequences/${seqId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [leadId] }),
      })
      if (!res.ok) throw new Error('Failed to enroll in sequence')
      setSuccess(true)
      setTimeout(onClose, 1000)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to add to sequence')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Add to Sequence</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-white/40" /></button>
        </div>
        {success ? <p className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Added!</p> : (
          <div className="space-y-2">
            {seqs.length === 0 && <p className="text-sm text-white/30">No sequences found.</p>}
            {seqs.map((s: any) => (
              <button key={s.id} onClick={() => addToSeq(s.id)} disabled={loading}
                className="w-full text-left px-3 py-2.5 border border-white/10 rounded-xl text-sm hover:bg-white/5 hover:border-violet-500/30 transition-all flex items-center justify-between">
                <span>{s.name}</span>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" /> : <ChevronRight className="h-3.5 w-3.5 text-white/30" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Right Detail Panel ───────────────────────────────────────────────────────
function LeadPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [actType, setActType] = useState('NOTE')
  const [actNote, setActNote] = useState('')
  const [loggingAct, setLoggingAct] = useState(false)
  const [showSeqModal, setShowSeqModal] = useState(false)

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ['lead-activities', lead.id],
    queryFn: () => fetch(`/api/leads/${lead.id}/activities`).then(r => r.json()),
  })

  function copyEmail() {
    if (lead.email) { navigator.clipboard.writeText(lead.email); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  async function logActivity() {
    if (!actNote.trim()) return
    setLoggingAct(true)
    
    // Optimistic update
    const previousActivities = qc.getQueryData<Activity[]>(['lead-activities', lead.id])
    const newActivity: Activity = {
      id: 'temp-' + Date.now(),
      type: actType,
      note: actNote,
      createdAt: new Date().toISOString()
    }
    qc.setQueryData<Activity[]>(['lead-activities', lead.id], (old) => [newActivity, ...(old || [])])
    
    const savedNote = actNote
    setActNote('')
    
    try {
      const res = await fetch(`/api/leads/${lead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: actType, note: savedNote }),
      })
      if (!res.ok) throw new Error('Failed to log activity')
      qc.invalidateQueries({ queryKey: ['lead-activities', lead.id] })
      toast.success('Activity logged')
    } catch (err: any) {
      qc.setQueryData(['lead-activities', lead.id], previousActivities)
      setActNote(savedNote)
      toast.error(err?.message ?? 'Failed to log activity')
    } finally {
      setLoggingAct(false)
    }
  }

  const actTypeIcon: Record<string, React.ReactNode> = {
    CALL: <Phone className="h-3 w-3 text-blue-400" />,
    EMAIL: <Mail className="h-3 w-3 text-violet-400" />,
    LINKEDIN: <Linkedin className="h-3 w-3 text-sky-400" />,
    NOTE: <Brain className="h-3 w-3 text-yellow-400" />,
    MEETING: <MessageSquare className="h-3 w-3 text-green-400" />,
  }

  return (
    <>
      {showSeqModal && <SequenceModal leadId={lead.id} onClose={() => setShowSeqModal(false)} />}
      <div className="w-80 shrink-0 border-l border-white/10 flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300">
              {initials(lead)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{lead.firstName} {lead.lastName}</h2>
                {icpBadge(lead.icpScore)}
              </div>
              <p className="text-xs text-white/40 mt-0.5">{[lead.title, lead.company].filter(Boolean).join(' at ')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white mt-0.5"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* Contact cards */}
          <div className="space-y-2">
            <div className="border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2"><Mail className="h-3.5 w-3.5 text-violet-400" /><span className="text-xs font-medium">Email</span></div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-white/80 flex-1 truncate">{lead.email ?? 'Not found'}</p>
                {lead.email && (
                  <button onClick={copyEmail} className="p-1 rounded hover:bg-white/5">
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-white/30" />}
                  </button>
                )}
              </div>
              {emailBadge(lead.emailStatus)}
            </div>

            {lead.phone && (
              <div className="border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1"><Phone className="h-3.5 w-3.5 text-blue-400" /><span className="text-xs font-medium">Phone</span></div>
                <p className="text-xs font-mono text-white/80">{lead.phone}</p>
              </div>
            )}

            {lead.linkedinUrl && (
              <div className="border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1"><Linkedin className="h-3.5 w-3.5 text-blue-500" /><span className="text-xs font-medium">LinkedIn</span></div>
                <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline truncate block">{lead.linkedinUrl}</a>
              </div>
            )}

            {lead.twitterUrl && (
              <div className="border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1"><Twitter className="h-3.5 w-3.5 text-sky-400" /><span className="text-xs font-medium">Twitter / X</span></div>
                <a href={lead.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline truncate block">{lead.twitterUrl}</a>
              </div>
            )}
          </div>

          {/* AI Summary */}
          {lead.aiSummary && (
            <div className="border border-violet-500/20 bg-violet-500/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Brain className="h-3.5 w-3.5 text-violet-400" /><span className="text-xs font-medium text-violet-300">AI Intelligence</span></div>
              <p className="text-xs text-white/70 leading-relaxed">{lead.aiSummary}</p>
              {lead.outreachAngle && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-xs text-white/30 mb-1">Outreach angle:</p>
                  <div className="flex items-start gap-1.5 p-2 bg-black/20 rounded-lg">
                    <ChevronRight className="h-3 w-3 text-violet-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-white/60 leading-relaxed">{lead.outreachAngle}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Feed */}
          <div>
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Activity</h4>
            {activitiesLoading ? (
              <div className="flex items-center gap-2 text-xs text-white/30 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading activities…
              </div>
            ) : activities.length === 0 ? (
              <p className="text-xs text-white/20">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-2 text-xs">
                    <span className="mt-0.5">{actTypeIcon[a.type] ?? <Brain className="h-3 w-3 text-white/30" />}</span>
                    <div>
                      <p className="text-white/60">{a.note}</p>
                      <p className="text-white/20">{new Date(a.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Log Activity Form */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider">Log Activity</h4>
            <select value={actType} onChange={e => setActType(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white">
              {['CALL', 'EMAIL', 'LINKEDIN', 'NOTE', 'MEETING'].map(t => <option key={t}>{t}</option>)}
            </select>
            <textarea
              rows={3}
              value={actNote}
              onChange={e => setActNote(e.target.value)}
              placeholder="Add a note…"
              className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 resize-none text-white placeholder:text-white/20"
            />
            <button onClick={logActivity} disabled={loggingAct || !actNote.trim()}
              className="w-full py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-40 transition-colors">
              {loggingAct ? 'Saving…' : 'Log'}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <button onClick={() => setShowSeqModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors">
            <Zap className="h-3.5 w-3.5" /> Add to Sequence
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [icpFilter, setIcpFilter] = useState<string>('all')
  const [emailFilter, setEmailFilter] = useState<string>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [enrichingAll, setEnrichingAll] = useState(false)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [newListName, setNewListName] = useState('')
  const [showNewList, setShowNewList] = useState(false)
  const [creatingList, setCreatingList] = useState(false)
  const [importing, setImporting] = useState(false)
  const [seqLeadId, setSeqLeadId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; event: React.MouseEvent } | null>(null)
  const PAGE_SIZE = 20

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: lists = [] } = useQuery<LeadList[]>({
    queryKey: ['leads-lists'],
    queryFn: () => fetch('/api/leads/lists').then(r => r.json()),
  })

  const { data: leadsData, isLoading } = useQuery<{ leads: Lead[], total: number }>({
    queryKey: ['leads', selectedListId, debouncedSearch, icpFilter, emailFilter, page],
    queryFn: () => {
      const p = new URLSearchParams({ 
        limit: PAGE_SIZE.toString(), 
        offset: (page * PAGE_SIZE).toString() 
      })
      if (selectedListId) p.set('listId', selectedListId)
      if (debouncedSearch) p.set('search', debouncedSearch)
      if (icpFilter !== 'all') p.set('icpFilter', icpFilter)
      if (emailFilter !== 'all') p.set('emailFilter', emailFilter)
      return fetch(`/api/leads?${p}`).then(r => r.json())
    },
  })

  const leads = leadsData?.leads ?? []
  const totalLeads = leadsData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE))

  const verifiedCount = leads.filter(l => l.emailStatus === 'VERIFIED').length
  const avgIcp = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + (l.icpScore ?? 0), 0) / leads.length) : 0

  async function createList() {
    if (!newListName.trim()) return
    setCreatingList(true)
    await fetch('/api/leads/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName }),
    })
    qc.invalidateQueries({ queryKey: ['leads-lists'] })
    setNewListName(''); setShowNewList(false); setCreatingList(false)
  }

  async function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/leads/import', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Import failed')
      qc.invalidateQueries({ queryKey: ['leads'] })
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to import CSV')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function exportLeads() {
    try {
      const p = new URLSearchParams()
      if (selectedListId) p.set('listId', selectedListId)
      if (debouncedSearch) p.set('search', debouncedSearch)
      const res = await fetch(`/api/leads/export?${p}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to export leads')
    }
  }

  async function enrichAll() {
    setEnrichingAll(true)
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: leads.map(l => l.id) }),
      })
      if (!res.ok) throw new Error('Enrichment failed')
      qc.invalidateQueries({ queryKey: ['leads'] })
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to enrich leads')
    } finally {
      setEnrichingAll(false)
    }
  }

  async function enrichOne(e: React.MouseEvent, leadId: string) {
    e.stopPropagation()
    setEnrichingId(leadId)
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [leadId] }),
      })
      if (!res.ok) throw new Error('Enrichment failed')
      qc.invalidateQueries({ queryKey: ['leads'] })
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to enrich lead')
    } finally {
      setEnrichingId(null)
    }
  }

  function requestDeleteLead(e: React.MouseEvent, leadId: string) {
    e.stopPropagation()
    setConfirmDelete({ id: leadId, event: e })
  }

  async function confirmDeleteLead() {
    if (!confirmDelete) return
    const leadId = confirmDelete.id
    setConfirmDelete(null)
    setDeletingId(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      qc.invalidateQueries({ queryKey: ['leads'] })
      if (selectedLead?.id === leadId) setSelectedLead(null)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete lead')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message="Are you sure you want to delete this lead?"
          onConfirm={confirmDeleteLead}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {seqLeadId && <SequenceModal leadId={seqLeadId} onClose={() => setSeqLeadId(null)} />}
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCSV} />

      <div className="flex flex-1 min-h-0 gap-0 flex-col md:flex-row">
        {/* ── Left Sidebar ──────────────────────────────────────────────────── */}
        <div className="md:w-64 w-full shrink-0 border-b md:border-b-0 md:border-r border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Users2 className="h-5 w-5 text-violet-400" /> Leads
                <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{totalLeads}</span>
                <HelpTip text="Your contacts. Import a CSV or pull them in via an actor/workflow, then enrich and enroll them into outreach sequences." example="Import prospects, enrich to score fit, email the 80+ scorers." />
              </h1>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/3 rounded-lg p-2 text-center">
                <p className="text-base font-bold">{totalLeads}</p>
                <p className="text-xs text-white/30">Total</p>
              </div>
              <div className="bg-white/3 rounded-lg p-2 text-center">
                <p className="text-base font-bold text-violet-400">{avgIcp || '—'}</p>
                <p className="text-xs text-white/30">Avg ICP</p>
              </div>
              <div className="bg-white/3 rounded-lg p-2 text-center">
                <p className="text-base font-bold text-green-400">{verifiedCount}</p>
                <p className="text-xs text-white/30">Verified</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <button
              onClick={() => setSelectedListId(null)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 text-sm flex items-center justify-between hover:bg-white/3 transition-colors ${selectedListId === null ? 'bg-white/5 border-l-2 border-l-violet-500 text-white' : 'text-white/60'}`}
            >
              <span>All Leads</span>
              <span className="text-xs text-white/30">{selectedListId === null ? totalLeads : ''}</span>
            </button>
            {lists.map(list => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`w-full text-left px-4 py-3 border-b border-white/5 text-sm flex items-center justify-between hover:bg-white/3 transition-colors ${selectedListId === list.id ? 'bg-white/5 border-l-2 border-l-violet-500 text-white' : 'text-white/60'}`}
              >
                <span>{list.name}</span>
                <span className="text-xs text-white/30">{list.leadCount}</span>
              </button>
            ))}

            {showNewList ? (
              <div className="p-3 border-b border-white/5 space-y-2">
                <input
                  autoFocus
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createList(); if (e.key === 'Escape') setShowNewList(false) }}
                  placeholder="List name…"
                  className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white placeholder:text-white/20"
                />
                <div className="flex gap-1">
                  <button onClick={createList} disabled={creatingList} className="flex-1 py-1 text-xs bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
                    {creatingList ? '…' : 'Create'}
                  </button>
                  <button onClick={() => setShowNewList(false)} className="px-2 py-1 text-xs border border-white/10 rounded-lg hover:bg-white/5">✕</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNewList(true)}
                className="w-full text-left px-4 py-3 text-sm text-white/40 hover:bg-white/3 transition-colors flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" /> New List
              </button>
            )}
          </div>

          <div className="p-3 border-t border-white/10 space-y-2">
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              className="w-full flex items-center justify-center gap-2 py-2 border border-white/10 rounded-lg text-xs text-white/60 hover:bg-white/5 transition-colors disabled:opacity-50">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <button onClick={exportLeads}
              className="w-full flex items-center justify-center gap-2 py-2 border border-white/10 rounded-lg text-xs text-white/60 hover:bg-white/5 transition-colors">
              Export
            </button>
          </div>
        </div>

        {/* ── Main Area ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 p-4 border-b border-white/10 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Search by name, email, company…"
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <select
              value={icpFilter}
              onChange={e => { setIcpFilter(e.target.value); setPage(0) }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">All ICP Scores</option>
              <option value="80+">80+ Score</option>
              <option value="60-79">60-79 Score</option>
              <option value="below60">Below 60</option>
            </select>
            <select
              value={emailFilter}
              onChange={e => { setEmailFilter(e.target.value); setPage(0) }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">All Email Status</option>
              <option value="VERIFIED">Verified</option>
              <option value="RISKY">Risky</option>
              <option value="NOT_FOUND">Not Found</option>
            </select>
            <button
              onClick={enrichAll}
              disabled={enrichingAll || leads.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              {enrichingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {enrichingAll ? 'Enriching…' : 'Enrich All'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-xs">
                    <th className="w-8 px-4 py-2" />
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-left px-4 py-2 hidden md:table-cell">Title</th>
                    <th className="text-left px-4 py-2 hidden md:table-cell">Company</th>
                    <th className="text-left px-4 py-2 hidden lg:table-cell">Email</th>
                    <th className="text-left px-4 py-2">ICP</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5 animate-pulse">
                      <td className="px-4 py-3"><div className="h-7 w-7 rounded-full bg-white/5" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-32 bg-white/5 rounded" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-24 bg-white/5 rounded" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-24 bg-white/5 rounded" /></td>
                      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-40 bg-white/5 rounded" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-12 bg-white/5 rounded-lg" /></td>
                      <td className="px-4 py-3"><div className="h-6 w-16 bg-white/5 rounded" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center animate-in fade-in duration-500">
                <div className="h-20 w-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6">
                  <Users2 className="h-10 w-10 text-violet-400/50" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No leads yet</h3>
                <p className="text-sm text-white/50 max-w-md mx-auto mb-2">
                  Leads are your contacts. Import a CSV here, or generate them automatically with an Actor or Workflow — then enrich and enroll them into outreach.
                </p>
                <p className="text-xs text-white/35 max-w-md mx-auto mb-8">
                  CSV columns: fullName, email, company, title, linkedinUrl
                </p>
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/10 rounded-xl text-sm font-medium transition-all group">
                  <Upload className="h-4 w-4 text-violet-400 group-hover:-translate-y-0.5 transition-transform" /> 
                  Import CSV
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-xs">
                    <th className="w-8 px-4 py-2" />
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Title</th>
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Company</th>
                    <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">Email</th>
                    <th className="text-left px-4 py-2 font-medium">ICP</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`border-b border-white/5 hover:bg-white/3 cursor-pointer group transition-colors ${selectedLead?.id === lead.id ? 'bg-white/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="h-7 w-7 rounded-full bg-violet-600/20 flex items-center justify-center text-xs font-bold text-violet-300">
                          {initials(lead)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {lead.firstName} {lead.lastName}
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs hidden md:table-cell">{lead.title ?? '—'}</td>
                      <td className="px-4 py-3 text-white/50 text-xs hidden md:table-cell">{lead.company ?? '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs text-white/70 truncate max-w-[180px]">{lead.email ?? '—'}</p>
                          {emailBadge(lead.emailStatus)}
                        </div>
                      </td>
                      <td className="px-4 py-3">{icpBadge(lead.icpScore)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => enrichOne(e, lead.id)}
                            disabled={enrichingId === lead.id}
                            className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs hover:bg-white/10 disabled:opacity-50"
                          >
                            {enrichingId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enrich'}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setSeqLeadId(lead.id) }}
                            className="px-2 py-1 bg-violet-600/20 border border-violet-500/30 rounded text-xs text-violet-300 hover:bg-violet-600/30"
                          >
                            + Seq
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedLead(lead) }}
                            className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs hover:bg-white/10"
                          >
                            View
                          </button>
                          <button
                            onClick={e => requestDeleteLead(e, lead.id)}
                            disabled={deletingId === lead.id}
                            className="p-1 rounded hover:bg-red-500/10 text-red-400/60 hover:text-red-400 disabled:opacity-50"
                          >
                            {deletingId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-white/10 flex items-center justify-between">
              <p className="text-xs text-white/30">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalLeads)} of {totalLeads}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                  className="px-3 py-1.5 text-xs border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-40">
                  Prev
                </button>
                <span className="text-xs text-white/30">{page + 1} / {totalPages}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Detail Panel ────────────────────────────────────────────── */}
        {selectedLead && (
          <LeadPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
        )}
      </div>
    </>
  )
}
