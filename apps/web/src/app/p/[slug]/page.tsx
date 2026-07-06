'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface PageCfg {
  headline: string; subheadline: string; leadMagnet: string; ctaText: string; consentText: string
  collectName: boolean; collectEmail: boolean; collectPhone: boolean
}

export default function PublicCapturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [cfg, setCfg] = useState<PageCfg | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', consent: false, company_url: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/public/capture/${slug}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setCfg)
      .catch(() => setNotFound(true))
  }, [slug])

  async function submit() {
    setErr('')
    if (cfg?.collectEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) { setErr('Please enter a valid email.'); return }
    if (!form.consent) { setErr('Please accept the consent checkbox.'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/capture/${slug}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Submission failed') }
      setDone(true)
    } catch (e: any) { setErr(e.message || 'Something went wrong.') }
    setSubmitting(false)
  }

  if (notFound) return <Centered><p className="text-white/50">This page is unavailable.</p></Centered>
  if (!cfg) return <Centered><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></Centered>

  const inp = 'w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500'

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-violet-600/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-md">
        {done ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">You're in! 🎉</h1>
            <p className="text-white/60">Thanks — we'll be in touch shortly about your demat/trading account.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <h1 className="text-3xl font-extrabold leading-tight mb-3">{cfg.headline}</h1>
            {cfg.subheadline && <p className="text-white/60 mb-4">{cfg.subheadline}</p>}
            {cfg.leadMagnet && <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-200 text-sm px-3 py-2 mb-5">🎁 {cfg.leadMagnet}</div>}
            <div className="space-y-3">
              {/* Honeypot — hidden from humans, catches bots. Must stay empty. */}
              <input type="text" name="company_url" tabIndex={-1} autoComplete="off" aria-hidden="true"
                value={form.company_url} onChange={e => setForm({ ...form, company_url: e.target.value })}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
              {cfg.collectName && <input className={inp} placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />}
              {cfg.collectEmail && <input className={inp} type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />}
              {cfg.collectPhone && <input className={inp} type="tel" placeholder="Phone number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />}
              <label className="flex items-start gap-2 text-xs text-white/50 pt-1">
                <input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} className="accent-violet-500 mt-0.5" />
                <span>{cfg.consentText}</span>
              </label>
              {err && <p className="text-xs text-red-400">{err}</p>}
              <button onClick={submit} disabled={submitting} className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}{cfg.ctaText}
              </button>
            </div>
            <p className="text-[11px] text-white/25 text-center mt-4">Powered by Tudumm</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 flex items-center justify-center">{children}</div>
}
