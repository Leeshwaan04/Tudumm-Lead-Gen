'use client'
import { HelpTip } from "@/components/ui/HelpTip";

import { useState, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Upload, Zap, CheckCircle, XCircle, Clock, Mail, Phone, Brain,
  Download, RefreshCw, ChevronRight, Loader2, X, Check,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string; firstName: string; lastName: string; fullName?: string
  title: string | null; company: string | null; email: string | null
  emailStatus: 'VERIFIED' | 'RISKY' | 'NOT_FOUND' | null
  phone: string | null; icpScore: number | null; aiSummary: string | null
  enrichResult?: any
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusBadge = (status: string | null) => {
  if (status === 'VERIFIED') return <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3 w-3" />Verified</span>
  if (status === 'RISKY') return <span className="flex items-center gap-1 text-xs text-yellow-400"><Clock className="h-3 w-3" />Risky</span>
  return <span className="flex items-center gap-1 text-xs text-white/30"><XCircle className="h-3 w-3" />Not found</span>
}

const icpColor = (score: number | null) => {
  if (!score) return 'bg-white/5 text-white/40'
  if (score >= 85) return 'bg-green-400/10 text-green-400'
  if (score >= 70) return 'bg-yellow-400/10 text-yellow-400'
  return 'bg-white/5 text-white/40'
}

// ─── Sequence Picker Modal ────────────────────────────────────────────────────
function SequenceModal({ leadIds, onClose }: { leadIds: string[]; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { data: seqs = [] } = useQuery<any[]>({
    queryKey: ['sequences'],
    queryFn: () => fetch('/api/sequences').then(r => r.json()),
  })
  async function pick(seqId: string) {
    setLoading(true)
    await fetch(`/api/sequences/${seqId}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds }),
    })
    setLoading(false); setDone(true)
    setTimeout(onClose, 800)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Add to Sequence</h3>
          <button type="button" aria-label="Close" onClick={onClose}><X className="h-4 w-4 text-white/40" /></button>
        </div>
        {done ? <p className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Added!</p> : (
          <div className="space-y-2">
            {seqs.length === 0 && <p className="text-sm text-white/30">No sequences found.</p>}
            {seqs.map((s: any) => (
              <button key={s.id} onClick={() => pick(s.id)} disabled={loading}
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EnrichmentPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [enrichingAll, setEnrichingAll] = useState(false)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [enrichProgress, setEnrichProgress] = useState(0)
  const [importing, setImporting] = useState(false)
  const [showSeqModal, setShowSeqModal] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3500) }

  const { data: leadsRaw = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['enrich-leads'],
    queryFn: () => fetch('/api/leads?limit=100').then(r => r.json()).then(d => Array.isArray(d) ? d : (d.leads ?? [])),
  })

  const verified = leadsRaw.filter(l => l.emailStatus === 'VERIFIED').length
  const aiScored = leadsRaw.filter(l => l.icpScore !== null).length
  const matchRate = leadsRaw.length > 0 ? Math.round((verified / leadsRaw.length) * 100) : 0

  async function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/leads/import', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Import failed')
      qc.invalidateQueries({ queryKey: ['enrich-leads'] })
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to import CSV')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function enrichAll() {
    if (leadsRaw.length === 0) return
    setEnrichingAll(true); setEnrichProgress(0)
    const ids = leadsRaw.map(l => l.id)
    try {
      const res = await fetch('/api/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: ids }),
      })
      if (!res.ok) throw new Error('Enrichment request failed')

      // Poll /api/enrichment every 2 s for real progress
      pollRef.current = setInterval(async () => {
        try {
          const poll = await fetch('/api/enrichment')
          if (poll.ok) {
            const data = await poll.json()
            const pct = typeof data?.progress === 'number' ? data.progress : null
            if (pct !== null) setEnrichProgress(Math.min(pct, 99))
            if (data?.done || pct === 100) {
              if (pollRef.current) clearInterval(pollRef.current)
              setEnrichProgress(100)
              qc.invalidateQueries({ queryKey: ['enrich-leads'] })
              setTimeout(() => { setEnrichingAll(false); setEnrichProgress(0) }, 800)
            }
          }
        } catch { /* polling errors are non-fatal */ }
      }, 2000)

      // Fallback: if API doesn't support progress polling, finish after response
      qc.invalidateQueries({ queryKey: ['enrich-leads'] })
      if (pollRef.current) clearInterval(pollRef.current)
      setEnrichProgress(100)
      setTimeout(() => { setEnrichingAll(false); setEnrichProgress(0) }, 800)
    } catch (err: any) {
      if (pollRef.current) clearInterval(pollRef.current)
      setEnrichingAll(false); setEnrichProgress(0)
      showToast(err?.message ?? 'Enrichment failed')
    }
  }

  async function enrichOne(leadId: string) {
    setEnrichingId(leadId)
    try {
      const res = await fetch('/api/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [leadId] }),
      })
      if (!res.ok) throw new Error('Enrichment failed')
      qc.invalidateQueries({ queryKey: ['enrich-leads'] })
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to enrich lead')
    } finally {
      setEnrichingId(null)
    }
  }

  async function exportCSV() {
    try {
      const res = await fetch('/api/leads/export?format=csv')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'enriched-leads.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to export CSV')
    }
  }

  const displayLead = selected ?? leadsRaw[0] ?? null

  return (
    <>
      {showSeqModal && displayLead && <SequenceModal leadIds={[displayLead.id]} onClose={() => setShowSeqModal(false)} />}
      <input ref={fileRef} type="file" accept=".csv" className="hidden" aria-label="Import CSV file" onChange={importCSV} />

      <div className="flex flex-1 min-h-0 gap-0 flex-col sm:flex-row">
        {/* ── Left: lead list ──────────────────────────────────────────────── */}
        <div className="w-full sm:w-80 shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold flex items-center gap-2">Enrichment
                <HelpTip text="Enrichment uses AI to score how well each lead fits your ideal customer and drafts a personalized opener. Run it after importing leads, before outreach." example="A 'CTO at a SaaS startup' scores 88 with a tailored first line." />
              </h1>
              <button onClick={() => fileRef.current?.click()} disabled={importing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors disabled:opacity-50">
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {importing ? 'Importing…' : 'Import CSV'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/3 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{leadsRaw.length}</p>
                <p className="text-xs text-white/30">Leads</p>
              </div>
              <div className="bg-white/3 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-green-400">{matchRate}%</p>
                <p className="text-xs text-white/30">Email hit</p>
              </div>
              <div className="bg-white/3 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-violet-400">{aiScored}</p>
                <p className="text-xs text-white/30">AI scored</p>
              </div>
            </div>

            <button onClick={enrichAll} disabled={enrichingAll || leadsRaw.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm transition-colors">
              {enrichingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {enrichingAll ? `Enriching… ${enrichProgress}%` : 'Enrich All'}
            </button>

            {enrichingAll && (
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-300" style={{ width: `${enrichProgress}%` }} />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-20 text-white/30 text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
              </div>
            ) : leadsRaw.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-white/30 text-xs gap-2">
                <Brain className="h-8 w-8 opacity-30" />
                <p>No leads yet</p>
                <button onClick={() => fileRef.current?.click()} className="text-violet-400 underline">Import CSV</button>
              </div>
            ) : leadsRaw.map(lead => (
              <div key={lead.id} role="button" tabIndex={0} onClick={() => setSelected(lead)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(lead) }}
                className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer ${displayLead?.id === lead.id ? 'bg-white/5 border-l-2 border-l-violet-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {lead.firstName} {lead.lastName}
                    </p>
                    <p className="text-xs text-white/40 truncate">{lead.title ?? ''}{lead.title && lead.company ? ' · ' : ''}{lead.company ?? ''}</p>
                  </div>
                  {lead.icpScore !== null && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-lg shrink-0 ${icpColor(lead.icpScore)}`}>{lead.icpScore}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-white/30">
                    <Mail className="h-3 w-3" />{lead.emailStatus === 'VERIFIED' ? '✓' : lead.emailStatus === 'RISKY' ? '~' : '✗'}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-white/30">
                    <Phone className="h-3 w-3" />{lead.phone ? '✓' : '✗'}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-white/30">
                    <Brain className="h-3 w-3" />{lead.aiSummary ? 'AI' : '—'}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); enrichOne(lead.id) }}
                    disabled={enrichingId === lead.id}
                    className="ml-auto text-xs px-2 py-0.5 bg-violet-600/20 border border-violet-500/20 rounded text-violet-300 hover:bg-violet-600/30 disabled:opacity-50"
                  >
                    {enrichingId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enrich'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/10">
            <button onClick={exportCSV}
              className="w-full flex items-center justify-center gap-2 py-2 border border-white/10 rounded-lg text-sm text-white/60 hover:bg-white/5 transition-colors">
              <Download className="h-3.5 w-3.5" /> Export Enriched CSV
            </button>
          </div>
        </div>

        {/* ── Right: lead detail ───────────────────────────────────────────── */}
        {displayLead ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold">{displayLead.firstName} {displayLead.lastName}</h2>
                  {displayLead.icpScore !== null && (
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${icpColor(displayLead.icpScore)}`}>
                      ICP: {displayLead.icpScore}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/40 mt-0.5">
                  {displayLead.title ?? ''}{displayLead.title && displayLead.company ? ' at ' : ''}{displayLead.company ?? ''}
                </p>
              </div>
              <button onClick={() => setShowSeqModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors">
                <Zap className="h-3.5 w-3.5" /> Add to Sequence
              </button>
            </div>

            {/* Contact cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-medium">Email</span>
                </div>
                {displayLead.email
                  ? <p className="text-sm font-mono text-white mb-2">{displayLead.email}</p>
                  : <p className="text-sm text-white/30 mb-2">Not found</p>
                }
                {statusBadge(displayLead.emailStatus)}

                {/* Waterfall */}
                {displayLead.enrichResult?.waterfall && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                    <p className="text-xs text-white/30 mb-2">Waterfall providers tried:</p>
                    {displayLead.enrichResult.waterfall.map((p: any) => (
                      <div key={p.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {p.hit ? <CheckCircle className="h-3 w-3 text-green-400" /> : <XCircle className="h-3 w-3 text-white/20" />}
                          <span className="text-xs text-white/50">{p.name}</span>
                        </div>
                        <span className="text-xs text-white/20">{p.latency ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!displayLead.enrichResult?.waterfall && displayLead.enrichResult && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-white/30">No provider waterfall data available.</p>
                  </div>
                )}
              </div>

              <div className="border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium">Phone</span>
                </div>
                {displayLead.phone
                  ? <p className="text-sm font-mono text-white mb-2">{displayLead.phone}</p>
                  : <p className="text-sm text-white/30 mb-2">Not found</p>
                }
                {statusBadge(displayLead.phone ? 'VERIFIED' : null)}
                {displayLead.enrichResult?.phoneSources ? (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                    <p className="text-xs text-white/30 mb-2">Sources checked:</p>
                    {displayLead.enrichResult.phoneSources.map((src: string) => (
                      <div key={src} className="flex items-center gap-2">
                        {displayLead.phone ? <CheckCircle className="h-3 w-3 text-green-400" /> : <XCircle className="h-3 w-3 text-white/20" />}
                        <span className="text-xs text-white/50">{src}</span>
                      </div>
                    ))}
                  </div>
                ) : displayLead.enrichResult ? (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-white/30">No phone source data available.</p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* AI Summary */}
            {displayLead.aiSummary ? (
              <div className="border border-violet-500/20 bg-violet-500/5 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-medium text-violet-300">AI Intelligence Summary</span>
                  <span className="text-xs text-white/30 ml-auto">Powered by Claude</span>
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{displayLead.aiSummary}</p>
              </div>
            ) : (
              <div className="border border-white/10 rounded-xl p-5 text-center space-y-3">
                <Brain className="h-8 w-8 text-white/20 mx-auto" />
                <p className="text-sm text-white/30">No AI summary yet</p>
                <button onClick={() => enrichOne(displayLead.id)} disabled={enrichingId === displayLead.id}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm mx-auto disabled:opacity-50">
                  {enrichingId === displayLead.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {enrichingId === displayLead.id ? 'Enriching…' : 'Enrich Now'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
            Select a lead to view enrichment details
          </div>
        )}
      </div>
    </>
  )
}
