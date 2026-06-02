'use client'

import {
  MessageSquare, Mail, Linkedin, Search, Inbox as InboxIcon,
  CheckCircle2, Loader2, RefreshCw, User, Send, CheckCheck,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

interface Reply {
  id: string
  leadId: string
  leadName: string
  leadEmail: string | null
  leadLinkedin: string | null
  sequenceName: string
  sequenceId: string
  platform: string
  stepIndex: number
  repliedAt: string
  note: string | null
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'linkedin' || platform === 'LINKEDIN')
    return <Linkedin className="h-3.5 w-3.5 text-blue-400" />
  return <Mail className="h-3.5 w-3.5 text-violet-400" />
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'linkedin'>('all')
  const [search, setSearch] = useState('')
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Reply | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set())
  const [loggedNotes, setLoggedNotes] = useState<Record<string, string[]>>({})
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const fetchReplies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox/replies')
      if (res.ok) {
        const data = await res.json()
        setReplies(Array.isArray(data) ? data : [])
      }
    } catch {
      setReplies([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchReplies() }, [fetchReplies])

  const filtered = replies.filter(r => {
    if (activeTab === 'email' && r.platform !== 'email' && r.platform !== 'EMAIL') return false
    if (activeTab === 'linkedin' && r.platform !== 'linkedin' && r.platform !== 'LINKEDIN') return false
    const q = search.toLowerCase()
    return !q || r.leadName.toLowerCase().includes(q) || r.sequenceName.toLowerCase().includes(q)
  })

  async function handleMarkHandled(r: Reply) {
    setSubmitting(true)
    try {
      await fetch(`/api/inbox/replies/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'handled', leadId: r.leadId }),
      })
      setHandledIds(prev => new Set([...prev, r.id]))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogNote(r: Reply) {
    if (!noteInput.trim()) return
    setSubmitting(true)
    try {
      await fetch(`/api/inbox/replies/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'note', note: noteInput.trim(), leadId: r.leadId }),
      })
      setLoggedNotes(prev => ({
        ...prev,
        [r.id]: [...(prev[r.id] ?? []), noteInput.trim()],
      }))
      setNoteInput('')
    } finally {
      setSubmitting(false)
    }
  }

  const isHandled = (r: Reply) => handledIds.has(r.id)

  return (
    <div className="flex h-full flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
            <InboxIcon className="h-5 w-5 md:h-6 md:w-6 text-violet-400" />
            Unified Inbox
          </h1>
          <p className="text-xs md:text-sm text-white/50 mt-1">Replies from your active sequences</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30">{replies.length} thread{replies.length !== 1 ? 's' : ''}</span>
          <button onClick={fetchReplies} className="p-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
            <RefreshCw className="h-4 w-4 text-white/40" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Thread List */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-b md:border-b-0 md:border-r border-white/10 flex-col bg-white/[0.02]`}>
          <div className="p-3 border-b border-white/10 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                placeholder="Search messages..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex bg-white/5 p-1 rounded-lg">
              {(['all', 'email', 'linkedin'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md transition-colors capitalize ${activeTab === tab ? 'bg-white/10 text-white shadow' : 'text-white/50 hover:text-white'}`}
                >
                  {tab === 'email' && <Mail className="h-3 w-3" />}
                  {tab === 'linkedin' && <Linkedin className="h-3 w-3" />}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center m-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                <div className="h-14 w-14 rounded-full bg-violet-500/10 flex items-center justify-center mb-3 ring-1 ring-violet-500/20">
                  <CheckCircle2 className="h-7 w-7 text-violet-400" />
                </div>
                <h3 className="font-semibold text-white text-sm">Inbox Zero</h3>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  No replies yet. Replies from your active sequences will appear here.
                </p>
                <Link href="/sequences" className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  Go to Sequences →
                </Link>
              </div>
            ) : (
              filtered.map(r => (
                <button
                  key={r.id}
                  onClick={() => { setSelected(r); setNoteInput('') }}
                  className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition-colors ${selected?.id === r.id ? 'bg-white/[0.08] border-l-2 border-l-violet-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <PlatformIcon platform={r.platform} />
                      <span className={`text-sm font-medium truncate ${isHandled(r) ? 'text-white/40 line-through' : ''}`}>{r.leadName}</span>
                      {isHandled(r) && <CheckCheck className="h-3 w-3 text-green-400 shrink-0" />}
                    </div>
                    <span className="text-xs text-white/30 shrink-0">{timeAgo(r.repliedAt)}</span>
                  </div>
                  <p className="text-xs text-white/40 truncate ml-5">{r.sequenceName} · Step {r.stepIndex + 1}</p>
                  {r.note && <p className="text-xs text-white/50 truncate ml-5 mt-0.5 italic">&ldquo;{r.note}&rdquo;</p>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail Pane */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {selected ? (
            <div className="flex flex-col h-full">
              {/* Thread Header */}
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <button onClick={() => setSelected(null)} className="md:hidden p-1.5 border border-white/10 rounded-lg hover:bg-white/5">
                  ←
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={selected.platform} />
                    <h2 className="font-semibold text-white truncate">{selected.leadName}</h2>
                    {isHandled(selected) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                        <CheckCheck className="h-3 w-3" /> Handled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    {selected.leadEmail || selected.leadLinkedin || 'No contact info'} · via{' '}
                    <Link href={`/sequences/${selected.sequenceId}`} className="text-violet-400 hover:underline">
                      {selected.sequenceName}
                    </Link>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/leads?id=${selected.leadId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-xs transition-colors text-white/70"
                  >
                    <User className="h-3.5 w-3.5" /> Lead
                  </Link>
                  {selected.leadLinkedin && (
                    <a
                      href={selected.leadLinkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:bg-white/5 rounded-lg text-xs transition-colors text-white/70"
                    >
                      <Linkedin className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Original reply event */}
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-violet-400">
                    {selected.leadName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{selected.leadName}</span>
                      <span className="text-xs text-white/30">{new Date(selected.repliedAt).toLocaleString()}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                        Replied · Step {selected.stepIndex + 1}
                      </span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl rounded-tl-none p-3 text-sm text-white/80">
                      {selected.note
                        ? <span className="italic">&ldquo;{selected.note}&rdquo;</span>
                        : <span className="text-white/40 italic">Reply detected — no message body captured yet. Log a note below.</span>
                      }
                    </div>
                  </div>
                </div>

                {/* Previously logged notes */}
                {(loggedNotes[selected.id] ?? []).map((n, i) => (
                  <div key={i} className="flex gap-3 justify-end">
                    <div className="max-w-sm">
                      <div className="bg-violet-600/20 border border-violet-500/20 rounded-xl rounded-tr-none p-3 text-sm text-white/80">
                        {n}
                      </div>
                      <p className="text-xs text-white/30 text-right mt-1">You · just now</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-xs font-bold text-white/60">
                      Me
                    </div>
                  </div>
                ))}
              </div>

              {/* Action bar */}
              <div className="border-t border-white/10 p-4 space-y-3">
                <div className="flex gap-2">
                  <textarea
                    ref={noteRef}
                    rows={2}
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleLogNote(selected)
                    }}
                    placeholder="Log a note or reply content... (⌘+Enter to save)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 resize-none"
                  />
                  <button
                    onClick={() => handleLogNote(selected)}
                    disabled={submitting || !noteInput.trim()}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-xl transition-colors self-end"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-white/30">Sequence: {selected.sequenceName} · {selected.leadEmail ?? selected.leadLinkedin ?? '—'}</p>
                  {!isHandled(selected) ? (
                    <button
                      onClick={() => handleMarkHandled(selected)}
                      disabled={submitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 rounded-lg text-xs transition-colors disabled:opacity-40"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Mark Handled
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCheck className="h-3.5 w-3.5" /> Handled
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-900/10 via-black to-black">
              <div className="flex flex-col items-center justify-center max-w-sm text-center p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
                <div className="h-14 w-14 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-7 w-7 text-violet-400" />
                </div>
                <h2 className="text-base font-medium text-white mb-2">No Thread Selected</h2>
                <p className="text-sm text-white/40 leading-relaxed">Select a reply to view the thread, log notes, and mark it handled.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
