'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Twitter, Instagram, Plus, Trash2, CheckCircle, RefreshCw, Loader2, X, AlertTriangle } from 'lucide-react'

type Platform = 'TWITTER' | 'INSTAGRAM'

interface SocialSession {
  id: string
  platform: Platform
  alias: string
  email: string
  status: 'ACTIVE' | 'EXPIRED' | 'BANNED'
  dailyLimit: number
  dailyUsed: number
  riskScore: number
  cookieSet: boolean
  lastUsedAt?: string
  createdAt: string
}

const PLATFORM_META: Record<Platform, {
  label: string
  icon: React.ElementType
  color: string
  cookieName: string
  devToolsPath: string
  placeholder: string
}> = {
  TWITTER: {
    label: 'Twitter / X',
    icon: Twitter,
    color: 'text-sky-400',
    cookieName: 'auth_token',
    devToolsPath: 'DevTools → Application → Cookies → twitter.com → auth_token',
    placeholder: 'Paste your auth_token cookie value here…',
  },
  INSTAGRAM: {
    label: 'Instagram',
    icon: Instagram,
    color: 'text-pink-400',
    cookieName: 'sessionid',
    devToolsPath: 'DevTools → Application → Cookies → instagram.com → sessionid',
    placeholder: 'Paste your sessionid cookie value here…',
  },
}

function statusBadge(status: string) {
  if (status === 'ACTIVE') return <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-400/10 text-green-400">ACTIVE</span>
  if (status === 'EXPIRED') return <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400">EXPIRED</span>
  return <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-400/10 text-red-400">BANNED</span>
}

function AddSessionForm({
  platform,
  onClose,
  onSaved,
}: {
  platform: Platform
  onClose: () => void
  onSaved: () => void
}) {
  const meta = PLATFORM_META[platform]
  const Icon = meta.icon
  const [alias, setAlias] = useState('')
  const [email, setEmail] = useState('')
  const [cookie, setCookie] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!alias || !cookie) { setError('Alias and cookie are required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/social/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, alias, email, sessionCookie: cookie }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-white/10 rounded-xl p-5 space-y-4 bg-white/2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${meta.color}`} />
          <span className="text-sm font-medium">Connect {meta.label} Account</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-white/40 mb-1.5">Account Name / Alias</label>
          <input value={alias} onChange={e => setAlias(e.target.value)}
            placeholder={`e.g. My ${meta.label} Account`}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40" />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1.5">Account Email (optional)</label>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" type="email"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40" />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1.5">{meta.cookieName} Cookie Value</label>
          <textarea value={cookie} onChange={e => setCookie(e.target.value)} rows={3}
            placeholder={meta.placeholder}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/40" />
          <p className="text-xs text-white/30 mt-1">{meta.devToolsPath}</p>
        </div>
      </div>
      <p className="text-xs text-white/30">Your cookie is stored encrypted and only used to authenticate browser actions on your behalf.</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save Session'}
        </button>
      </div>
    </div>
  )
}

function SessionCard({ session, onRefresh }: { session: SocialSession; onRefresh: () => void }) {
  const meta = PLATFORM_META[session.platform]
  const Icon = meta.icon
  const qc = useQueryClient()
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500) }

  async function testSession() {
    setTesting(true)
    try {
      const res = await fetch(`/api/social/sessions/${session.id}/test`, { method: 'POST' })
      const data = await res.json()
      showToast(data.valid ? `✓ ${data.reason}` : `✗ ${data.reason || data.error || 'Check failed'}`)
      qc.invalidateQueries({ queryKey: ['social-sessions'] })
    } catch (e: any) { showToast(`✗ ${e.message}`) }
    finally { setTesting(false) }
  }

  async function deleteSession() {
    if (!confirm('Remove this session?')) return
    setDeleting(true)
    await fetch(`/api/social/sessions/${session.id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['social-sessions'] })
    setDeleting(false)
  }

  const usagePct = Math.min(100, Math.round((session.dailyUsed / session.dailyLimit) * 100))

  return (
    <div className="border border-white/10 rounded-xl p-4 space-y-3">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl border bg-zinc-900 border-white/10 text-white">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 ${meta.color}`} />
          <div>
            <p className="text-sm font-medium">{session.alias}</p>
            <p className="text-xs text-white/40">{session.email || meta.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(session.status)}
          <button onClick={testSession} disabled={testing}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-white/10 rounded-lg text-xs hover:bg-white/5 transition-colors text-white/60 disabled:opacity-50">
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            {testing ? 'Testing…' : 'Test'}
          </button>
          <button onClick={deleteSession} disabled={deleting}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/10 transition-colors text-red-400 disabled:opacity-50">
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-white/3 rounded-lg p-2.5">
          <p className="text-white/30 mb-1">Daily Actions</p>
          <p className="font-semibold">{session.dailyUsed}<span className="text-white/30">/{session.dailyLimit}</span></p>
          <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${usagePct >= 100 ? 'bg-red-400' : usagePct > 70 ? 'bg-yellow-400' : 'bg-green-400'}`}
              style={{ width: `${usagePct}%` }} />
          </div>
        </div>
        <div className="bg-white/3 rounded-lg p-2.5">
          <p className="text-white/30 mb-1">Last Used</p>
          <p className="font-semibold">{session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleDateString() : 'Never'}</p>
        </div>
      </div>
    </div>
  )
}

function PlatformSection({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform]
  const Icon = meta.icon
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)

  const { data: sessions = [], isLoading } = useQuery<SocialSession[]>({
    queryKey: ['social-sessions', platform],
    queryFn: async () => {
      const r = await fetch(`/api/social/sessions?platform=${platform}`)
      const d = await r.json().catch(() => [])
      return Array.isArray(d) ? d : []
    },
    refetchInterval: 30000,
  })

  return (
    <div className="border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-5 w-5 ${meta.color}`} />
          <div>
            <h2 className="font-semibold">{meta.label}</h2>
            <p className="text-xs text-white/40">Authenticated scraping via {meta.cookieName} cookie</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs font-medium transition-colors">
          <Plus className="h-3.5 w-3.5" />Connect Account
        </button>
      </div>

      {showAdd && (
        <AddSessionForm platform={platform} onClose={() => setShowAdd(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['social-sessions', platform] })} />
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/30 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : sessions.length === 0 && !showAdd ? (
        <div className="text-center py-6 text-white/30 text-sm">
          No {meta.label} accounts connected.
          <button onClick={() => setShowAdd(true)} className="ml-1 text-violet-400 hover:text-violet-300 underline">Add one</button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <SessionCard key={s.id} session={s} onRefresh={() => qc.invalidateQueries({ queryKey: ['social-sessions', platform] })} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SocialAccountsPage() {
  return (
    <div className="p-6 overflow-y-auto flex-1 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Social Accounts</h1>
        <p className="text-sm text-white/40 mt-1">
          Connect session cookies to enable authenticated scraping on Twitter/X and Instagram.
          Cookies are encrypted at rest and never exposed to the client.
        </p>
      </div>

      <PlatformSection platform="TWITTER" />
      <PlatformSection platform="INSTAGRAM" />

      <div className="border border-white/5 rounded-xl p-4 bg-white/2 text-xs text-white/30 space-y-1">
        <p className="font-medium text-white/50">How to get your cookie</p>
        <p>1. Log in to the platform in your browser.</p>
        <p>2. Open DevTools (F12) → Application → Storage → Cookies.</p>
        <p>3. Find the cookie listed above and copy its Value.</p>
        <p>4. Paste it here. Tudumm encrypts it (AES-256-GCM) before storing.</p>
      </div>
    </div>
  )
}
