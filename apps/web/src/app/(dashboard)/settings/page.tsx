'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  User, Building, Key, Shield, Copy, Plus, Trash2, Eye, EyeOff,
  Check, Loader2, X, AlertCircle, CheckCircle2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiKey { id: string; name: string; keyPrefix: string; lastUsedAt: string | null; createdAt: string; scopes: string[] }
interface Member { id: string; userId: string; role: string; user: { name: string | null; email: string } }

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl animate-in slide-in-from-bottom-4 duration-200 ${type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
      {type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      <span className="text-sm">{msg}</span>
      <button onClick={onClose}><X className="h-3.5 w-3.5 opacity-60" /></button>
    </div>
  )
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
      onCreated(data.key ?? data.id)
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
          <p className="text-xs text-white/40 mb-2">Copy this key now — it won't be shown again.</p>
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
]

export default function SettingsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('profile')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

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
      showToast('Profile saved')
    } catch (e: any) { showToast(e.message, 'error') }
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
      showToast('Workspace saved')
    } catch (e: any) { showToast(e.message, 'error') }
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
      setInviteEmail(''); showToast('Invitation sent')
    } catch (e: any) { showToast(e.message, 'error') }
    setInviting(false)
  }
  async function removeMember(id: string) {
    setRemovingId(id)
    await fetch(`/api/members/${id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['members'] })
    setRemovingId(null)
    showToast('Member removed')
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
      showToast('Password updated')
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

  async function revokeKey(id: string) {
    if (!confirm('Revoke this key?')) return
    setRevokingId(id)
    await fetch(`/api/settings/apikeys?id=${id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['api-keys'] })
    setRevokingId(null)
    showToast('Key revoked')
  }

  function copyKey(id: string, prefix: string) {
    navigator.clipboard.writeText(prefix + '...')
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showNewKey && (
        <NewKeyModal
          onClose={() => setShowNewKey(false)}
          onCreated={key => { setShowNewKey(false); setCreatedKey(key); qc.invalidateQueries({ queryKey: ['api-keys'] }) }}
        />
      )}
      {createdKey && <CreatedKeyModal apiKey={createdKey} onClose={() => setCreatedKey(null)} />}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-56 shrink-0 border-r border-white/10 p-4 space-y-1">
          <p className="text-xs text-white/30 uppercase tracking-wider px-3 mb-3">Settings</p>
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === tab.id ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                <Icon className="h-4 w-4" />{tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 max-w-2xl">

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
                        <button onClick={() => removeMember(m.id)} disabled={removingId === m.id}
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
                  <input type="password" placeholder="New password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white" />
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
                <div className="border border-dashed border-white/10 rounded-xl p-8 text-center">
                  <Key className="h-8 w-8 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/30 mb-3">No API keys yet</p>
                  <button onClick={() => setShowNewKey(true)}
                    className="text-xs text-violet-400 hover:underline">Create your first key</button>
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
                          <button onClick={() => copyKey(key.id, key.keyPrefix)}
                            className="p-1 rounded hover:bg-white/5 transition-colors">
                            {copiedId === key.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-white/40" />}
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

        </div>
      </div>
    </>
  )
}
