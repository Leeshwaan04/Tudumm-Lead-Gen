'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  User, Building, Key, Shield, Copy, Plus, Trash2, Eye, EyeOff,
  Check, Loader2, X, AlertCircle, CheckCircle2, Webhook,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiKey { id: string; name: string; keyPrefix: string; lastUsedAt: string | null; createdAt: string; scopes: string[]; key?: string }
interface Member { id: string; userId: string; role: string; user: { name: string | null; email: string } }



// ─── Password Strength Indicator ─────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  function getStrength(pwd: string): { label: string; color: string; width: string; bars: number } {
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

    if (pwd.length < 8) {
      return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3', bars: 1 };
    }
    if (pwd.length >= 8 && varietyCount <= 2) {
      return { label: 'Medium', color: 'bg-yellow-500', width: 'w-2/3', bars: 2 };
    }
    if (pwd.length >= 12 && varietyCount >= 3) {
      return { label: 'Strong', color: 'bg-green-500', width: 'w-full', bars: 3 };
    }
    return { label: 'Medium', color: 'bg-yellow-500', width: 'w-2/3', bars: 2 };
  }

  const strength = getStrength(password);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3].map(bar => (
          <div
            key={bar}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${bar <= strength.bars ? strength.color : 'bg-white/10'}`}
          />
        ))}
      </div>
      <p className={`text-xs ${strength.bars === 1 ? 'text-red-400' : strength.bars === 2 ? 'text-yellow-400' : 'text-green-400'}`}>
        Password strength: {strength.label}
      </p>
    </div>
  );
}

// ─── New Key Modal ────────────────────────────────────────────────────────────
function NewKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (key: string) => void }) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['read'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const allScopes = ['read', 'write', 'delete']

  function toggleScope(s: string) {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function create() {
    if (!name.trim()) { setError('Name required'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/settings/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scopes }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      onCreated(data.raw ?? data.key ?? data.id)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#121214] border border-white/10 rounded-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Create API Key</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-white/40" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Key Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Production, CI/CD"
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white" />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-2">Scopes</label>
            <div className="flex gap-2">
              {allScopes.map(s => (
                <button key={s} onClick={() => toggleScope(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${scopes.includes(s) ? 'bg-violet-600/20 border-violet-500/30 text-violet-300' : 'border-white/10 text-white/40 hover:bg-white/5'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5">Cancel</button>
          <button onClick={create} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? 'Creating…' : 'Create Key'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Created Key Display ──────────────────────────────────────────────────────
function CreatedKeyModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  function copy() { navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#121214] border border-white/10 rounded-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
          <h3 className="font-semibold">API Key Created</h3>
        </div>
        <div className="bg-black/40 border border-green-500/20 rounded-xl p-4">
          <p className="text-xs text-white/40 mb-2">Copy this key now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-green-300 flex-1 break-all">{apiKey}</code>
            <button onClick={copy} className="p-1.5 rounded hover:bg-white/5 shrink-0">
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-white/40" />}
            </button>
          </div>
        </div>
        <button onClick={onClose} className="w-full py-2 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg">Done</button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'workspace', label: 'Workspace', icon: Building },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'apikeys', label: 'API Keys', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
]

export default function SettingsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('profile')

  // ── Profile ──────────────────────────────────────────────────────────────
  const { data: profile } = useQuery<any>({
    queryKey: ['settings-profile'],
    queryFn: () => fetch('/api/settings/profile').then(r => r.json()),
  })
  const [profileName, setProfileName] = useState('')
  useEffect(() => { if (profile?.name) setProfileName(profile.name) }, [profile])
  const [savingProfile, setSavingProfile] = useState(false)
  async function saveProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      qc.invalidateQueries({ queryKey: ['settings-profile'] })
      toast.success('Profile saved')
    } catch (e: any) { toast.error(e.message) }
    setSavingProfile(false)
  }

  // ── Workspace ─────────────────────────────────────────────────────────────
  const { data: workspace } = useQuery<any>({
    queryKey: ['workspace'],
    queryFn: () => fetch('/api/workspace').then(r => r.json()),
  })
  const [wsName, setWsName] = useState('')
  const [wsSlug, setWsSlug] = useState('')
  useEffect(() => {
    if (workspace?.name) setWsName(workspace.name)
    if (workspace?.slug) setWsSlug(workspace.slug)
  }, [workspace])
  const [savingWs, setSavingWs] = useState(false)
  async function saveWorkspace() {
    setSavingWs(true)
    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wsName, slug: wsSlug }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      qc.invalidateQueries({ queryKey: ['workspace'] })
      toast.success('Workspace saved')
    } catch (e: any) { toast.error(e.message) }
    setSavingWs(false)
  }

  // Members
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: () => fetch('/api/members').then(r => r.json()),
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  async function inviteMember() {
    if (!inviteEmail) return
    setInviting(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      qc.invalidateQueries({ queryKey: ['members'] })
      setInviteEmail(''); toast.success('Invitation sent')
    } catch (e: any) { toast.error(e.message) }
    setInviting(false)
  }
  async function removeMember(id: string, name: string) {
    const displayName = name || 'this member'
    if (!confirm(`Are you sure you want to remove ${displayName}?`)) return
    setRemovingId(id)
    await fetch(`/api/members/${id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['members'] })
    setRemovingId(null)
    toast.success('Member removed')
  }

  // ── Security ──────────────────────────────────────────────────────────────
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')
  async function changePassword() {
    if (newPwd !== confirmPwd) { setPwdError('Passwords do not match'); return }
    if (newPwd.length < 8) { setPwdError('Password must be at least 8 characters'); return }
    setPwdError(''); setChangingPwd(true)
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setCurPwd(''); setNewPwd(''); setConfirmPwd('')
      toast.success('Password updated')
    } catch (e: any) { setPwdError(e.message) }
    setChangingPwd(false)
  }

  // ── API Keys ──────────────────────────────────────────────────────────────
  const { data: apiKeys = [] } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => fetch('/api/settings/apikeys').then(r => r.json()),
  })
  const [showNewKey, setShowNewKey] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [showKeyId, setShowKeyId] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // Store full key values in memory (only available at creation time via createdKey modal)
  // For listed keys we only have prefix; copy will copy what we have
  const [fullKeyStore, setFullKeyStore] = useState<Record<string, string>>({})

  async function revokeKey(id: string) {
    if (!confirm('Revoke this key?')) return
    setRevokingId(id)
    await fetch(`/api/settings/apikeys?id=${id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['api-keys'] })
    setRevokingId(null)
    toast.success('Key revoked')
  }

  function copyKey(id: string, keyPrefix: string, fullKey?: string) {
    // Copy the full key if we have it stored (from creation), otherwise copy what we have
    const valueToCopy = fullKey ?? fullKeyStore[id] ?? keyPrefix
    navigator.clipboard.writeText(valueToCopy)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────
  const { data: webhooks = [] } = useQuery<any[]>({
    queryKey: ['webhooks'],
    queryFn: () => fetch('/api/settings/webhooks').then(r => r.json()),
  })
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [addingWebhook, setAddingWebhook] = useState(false)
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null)

  async function addWebhook() {
    if (!newWebhookUrl) return
    setAddingWebhook(true)
    try {
      const res = await fetch('/api/settings/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newWebhookUrl, events: ['*'] }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      setNewWebhookUrl('')
      toast.success('Webhook added')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAddingWebhook(false)
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Remove this webhook?')) return
    setDeletingWebhookId(id)
    try {
      const res = await fetch(`/api/settings/webhooks?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook removed')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeletingWebhookId(null)
    }
  }

  return (
    <>
      {showNewKey && (
        <NewKeyModal
          onClose={() => setShowNewKey(false)}
          onCreated={key => {
            setShowNewKey(false)
            setCreatedKey(key)
            qc.invalidateQueries({ queryKey: ['api-keys'] })
          }}
        />
      )}
      {createdKey && <CreatedKeyModal apiKey={createdKey} onClose={() => setCreatedKey(null)} />}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Sidebar — horizontal scrollable tab bar on mobile, vertical sidebar on md+ */}
        <div className="md:w-56 md:shrink-0 md:border-r md:border-white/10 md:p-4 md:space-y-1 border-b border-white/10">
          <p className="hidden md:block text-xs text-white/30 uppercase tracking-wider px-3 mb-3">Settings</p>
          {/* Mobile: horizontal tab strip */}
          <div className="flex md:flex-col gap-1 overflow-x-auto px-4 py-2 md:px-0 md:py-0 md:overflow-x-visible scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 md:gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors shrink-0 md:w-full ${activeTab === tab.id ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                  <Icon className="h-4 w-4" />{tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-2xl">

          {/* ── Profile ──────────────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Profile</h2>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-violet-600 flex items-center justify-center text-2xl font-semibold">
                  {profileName?.[0]?.toUpperCase() ?? 'U'}
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Name</label>
                <input
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Email</label>
                <input
                  defaultValue={profile?.email ?? ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm bg-white/3 border border-white/10 rounded-lg outline-none text-white/40 cursor-not-allowed"
                />
              </div>
              <button onClick={saveProfile} disabled={savingProfile}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors disabled:opacity-50">
                {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* ── Workspace ────────────────────────────────────────────────── */}
          {activeTab === 'workspace' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Workspace</h2>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Workspace Name</label>
                <input value={wsName} onChange={e => setWsName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white" />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Workspace Slug</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 text-sm bg-white/3 border border-r-0 border-white/10 rounded-l-lg text-white/40">tudumm.io/</span>
                  <input value={wsSlug} onChange={e => setWsSlug(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-r-lg outline-none focus:border-violet-500 text-white" />
                </div>
              </div>
              <button onClick={saveWorkspace} disabled={savingWs}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors disabled:opacity-50">
                {savingWs && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {savingWs ? 'Saving…' : 'Save Changes'}
              </button>

              {/* Members */}
              <div className="border-t border-white/10 pt-6 space-y-4">
                <h3 className="font-medium">Team Members</h3>
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 border border-white/10 rounded-xl">
                      <div>
                        <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                        <p className="text-xs text-white/40">{m.user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-white/50">{m.role}</span>
                        <button
                          onClick={() => removeMember(m.id, m.user.name ?? m.user.email)}
                          disabled={removingId === m.id}
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-400/50 hover:text-red-400 disabled:opacity-40">
                          {removingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white placeholder:text-white/20"
                  />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                    className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white">
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button onClick={inviteMember} disabled={inviting || !inviteEmail}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
                    {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Invite
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Security ─────────────────────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Security</h2>
              <div className="border border-white/10 rounded-xl p-5">
                <h3 className="font-medium mb-1">Change Password</h3>
                <p className="text-xs text-white/40 mb-4">Choose a strong password with at least 8 characters</p>
                <div className="space-y-3">
                  <input type="password" placeholder="Current password" value={curPwd} onChange={e => setCurPwd(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white" />
                  <div className="space-y-2">
                    <input type="password" placeholder="New password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white" />
                    <PasswordStrength password={newPwd} />
                  </div>
                  <input type="password" placeholder="Confirm new password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white" />
                  {pwdError && (
                    <p className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" />{pwdError}
                    </p>
                  )}
                  <button onClick={changePassword} disabled={changingPwd}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm disabled:opacity-50">
                    {changingPwd && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {changingPwd ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── API Keys ──────────────────────────────────────────────────── */}
          {activeTab === 'apikeys' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">API Keys</h2>
                <button onClick={() => setShowNewKey(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors">
                  <Plus className="h-3.5 w-3.5" /> New Key
                </button>
              </div>
              <p className="text-sm text-white/40">Keep your keys secret — never commit them to version control.</p>

              {apiKeys.length === 0 ? (
                <div className="bg-white/[0.02] border border-white/5 shadow-inner rounded-2xl p-10 flex flex-col items-center justify-center text-center mt-4">
                  <div className="h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4 ring-1 ring-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <Key className="h-8 w-8 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No API keys yet</h3>
                  <p className="text-sm text-white/40 mb-6 max-w-sm leading-relaxed">Create an API key to authenticate requests from your custom scripts or third-party services.</p>
                  <button onClick={() => setShowNewKey(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded-xl text-sm font-medium text-violet-300 transition-colors">
                    <Plus className="h-4 w-4" />Create your first key
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map(key => (
                    <div key={key.id} className="border border-white/10 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-xs text-white/30 mt-0.5">
                            Created {new Date(key.createdAt).toLocaleDateString()}
                            {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <button onClick={() => revokeKey(key.id)} disabled={revokingId === key.id}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-40">
                          {revokingId === key.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-sm bg-black/30 rounded-lg px-3 py-2">
                        <span className="text-white/60">
                          {showKeyId[key.id] ? `${key.keyPrefix}${'*'.repeat(16)}` : `${key.keyPrefix}••••••••••••`}
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          <button onClick={() => setShowKeyId(s => ({ ...s, [key.id]: !s[key.id] }))}
                            className="p-1 rounded hover:bg-white/5 transition-colors">
                            {showKeyId[key.id] ? <EyeOff className="h-3.5 w-3.5 text-white/40" /> : <Eye className="h-3.5 w-3.5 text-white/40" />}
                          </button>
                          <button
                            onClick={() => copyKey(key.id, key.keyPrefix, key.key)}
                            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors text-xs"
                            title="Copy API key"
                          >
                            {copiedId === key.id
                              ? <><Check className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Copied!</span></>
                              : <><Copy className="h-3.5 w-3.5 text-white/40" /><span className="text-white/40">Copy</span></>
                            }
                          </button>
                        </div>
                      </div>
                      {key.scopes?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {key.scopes.map(s => (
                            <span key={s} className="text-xs px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-white/50">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Webhooks ──────────────────────────────────────────────────── */}
          {activeTab === 'webhooks' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Webhooks & Integrations</h2>
              <p className="text-sm text-white/40">Configure webhooks to receive real-time updates when leads are enriched or sequences complete.</p>
              
              <div className="flex gap-2">
                <input
                  value={newWebhookUrl}
                  onChange={e => setNewWebhookUrl(e.target.value)}
                  placeholder="https://your-crm.com/api/webhook"
                  className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white placeholder:text-white/20"
                />
                <button onClick={addWebhook} disabled={addingWebhook || !newWebhookUrl}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50 transition-colors">
                  {addingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add Webhook
                </button>
              </div>

              {webhooks.length === 0 ? (
                <div className="bg-white/[0.02] border border-white/5 shadow-inner rounded-2xl p-10 flex flex-col items-center justify-center text-center mt-6">
                  <div className="h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4 ring-1 ring-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <Webhook className="h-8 w-8 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No Webhooks Configured</h3>
                  <p className="text-sm text-white/40 max-w-sm leading-relaxed">Add a webhook URL to receive real-time POST requests when significant events occur.</p>
                </div>
              ) : (
                <div className="space-y-3 mt-6">
                  {webhooks.map((wh: any) => (
                    <div key={wh.id} className="border border-white/10 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                          <p className="font-mono text-sm text-white truncate">{wh.url}</p>
                        </div>
                        <p className="text-xs text-white/40">Secret: <span className="text-white/20 font-mono blur-[2px] hover:blur-none transition-all">{wh.secret}</span></p>
                      </div>
                      <button onClick={() => deleteWebhook(wh.id)} disabled={deletingWebhookId === wh.id}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-40 shrink-0">
                        {deletingWebhookId === wh.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
