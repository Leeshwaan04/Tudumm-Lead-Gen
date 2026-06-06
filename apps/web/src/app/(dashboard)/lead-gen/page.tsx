'use client'

import { useState, useEffect } from 'react'
import { Plus, ExternalLink, Copy, Check, Trash2, Eye, Users2, X, Megaphone, RefreshCw } from 'lucide-react'
import { HelpTip } from '@/components/ui/HelpTip'

interface CapturePage {
  id: string
  slug: string
  title: string
  headline: string
  subheadline: string
  leadMagnet: string
  ctaText: string
  collectName: boolean
  collectEmail: boolean
  collectPhone: boolean
  consentText: string
  views: number
  submissions: number
  published: boolean
}

const PUBLIC_BASE = typeof window !== 'undefined' ? window.location.origin : 'https://tudumm.in'

export default function LeadGenPage() {
  const [pages, setPages] = useState<CapturePage[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/capture-pages')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setPages(Array.isArray(d) ? d : []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  function copyLink(p: CapturePage) {
    navigator.clipboard.writeText(`${PUBLIC_BASE}/p/${p.slug}`)
    setCopiedId(p.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function remove(id: string) {
    if (!confirm('Delete this capture page? Existing leads are kept.')) return
    await fetch(`/api/capture-pages/${id}`, { method: 'DELETE' })
    load()
  }

  const totalLeads = pages.reduce((s, p) => s + p.submissions, 0)
  const totalViews = pages.reduce((s, p) => s + p.views, 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Lead Gen <HelpTip text="Create a hosted landing page with a lead-capture form. Share its link (or run ads to it) — every person who opts in becomes a consented B2C lead in Tudumm. This is the compliant, scalable way to generate quality demat/trading leads." example="Lead magnet: 'Free guide — open a demat account in 5 minutes' → form → leads." />
          </h1>
          <p className="text-sm text-white/50 mt-1">Capture consented B2C leads with hosted landing pages.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors">
          <Plus className="h-4 w-4" /> Create Capture Page
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-bold text-white">{pages.length}</div><div className="text-xs text-white/40 mt-1">Capture Pages</div></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-bold text-white">{totalViews}</div><div className="text-xs text-white/40 mt-1">Total Views</div></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-bold text-emerald-400">{totalLeads}</div><div className="text-xs text-white/40 mt-1">Leads Captured</div></div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-5 w-5 animate-spin text-violet-400" /></div>
      ) : pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
          <Megaphone className="h-10 w-10 text-violet-400/60 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-1">No capture pages yet</h3>
          <p className="text-sm text-white/40 mb-5 max-w-md mx-auto">Create a landing page with a lead magnet, share the link or run ads to it, and capture real opted-in demat/trading leads.</p>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors"><Plus className="h-4 w-4" /> Create your first page</button>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map(p => (
            <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{p.title}</span>
                  {p.published ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Live</span> : <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">Paused</span>}
                </div>
                <a href={`${PUBLIC_BASE}/p/${p.slug}`} target="_blank" rel="noreferrer" className="text-xs text-violet-400 hover:underline flex items-center gap-1 mt-0.5">/p/{p.slug} <ExternalLink className="h-3 w-3" /></a>
              </div>
              <div className="flex items-center gap-5 text-xs text-white/50 shrink-0">
                <span className="flex items-center gap-1" title="Views"><Eye className="h-3.5 w-3.5" />{p.views}</span>
                <span className="flex items-center gap-1 text-emerald-400" title="Leads captured"><Users2 className="h-3.5 w-3.5" />{p.submissions}</span>
                <button onClick={() => copyLink(p)} className="flex items-center gap-1 px-2 py-1 border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-white/70">
                  {copiedId === p.id ? <><Check className="h-3.5 w-3.5 text-emerald-400" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy link</>}
                </button>
                <button onClick={() => remove(p.id)} className="text-white/30 hover:text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
    </div>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({
    title: '', headline: 'Open your free Demat & Trading account',
    subheadline: 'Start investing in stocks, IPOs & mutual funds in minutes.',
    leadMagnet: 'Get a free step-by-step demat account opening guide.',
    ctaText: 'Get Started Free',
    consentText: 'I agree to be contacted about demat/trading account opening.',
    collectName: true, collectEmail: true, collectPhone: true,
  })
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!f.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/capture-pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      if (!res.ok) throw new Error('failed')
      onCreated()
    } catch { alert('Could not create. Try again.'); setSaving(false) }
  }

  const inp = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-slate-900 p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Create a capture page</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs text-white/50 mb-1 block">Page name (internal) *</label><input autoFocus className={inp} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Demat — Free Guide Campaign" /></div>
          <div><label className="text-xs text-white/50 mb-1 block">Headline</label><input className={inp} value={f.headline} onChange={e => setF({ ...f, headline: e.target.value })} /></div>
          <div><label className="text-xs text-white/50 mb-1 block">Subheadline</label><input className={inp} value={f.subheadline} onChange={e => setF({ ...f, subheadline: e.target.value })} /></div>
          <div><label className="text-xs text-white/50 mb-1 block">Lead magnet (what they get)</label><input className={inp} value={f.leadMagnet} onChange={e => setF({ ...f, leadMagnet: e.target.value })} /></div>
          <div><label className="text-xs text-white/50 mb-1 block">Button text</label><input className={inp} value={f.ctaText} onChange={e => setF({ ...f, ctaText: e.target.value })} /></div>
          <div className="flex gap-4 pt-1">
            {(['collectName', 'collectEmail', 'collectPhone'] as const).map(k => (
              <label key={k} className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={f[k]} onChange={e => setF({ ...f, [k]: e.target.checked })} className="accent-violet-500" />{k.replace('collect', '')}</label>
            ))}
          </div>
          <div><label className="text-xs text-white/50 mb-1 block">Consent text (required for compliance)</label><input className={inp} value={f.consentText} onChange={e => setF({ ...f, consentText: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={create} disabled={saving || !f.title.trim()} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2">{saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}{saving ? 'Creating…' : 'Create Page'}</button>
        </div>
      </div>
    </div>
  )
}
