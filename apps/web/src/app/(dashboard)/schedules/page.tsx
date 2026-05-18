'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock, Plus, Play, Pause, Trash2, Calendar, Zap,
  CheckCircle, AlertCircle, Loader2, Edit2, X, RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Actor {
  id: string
  name: string
  slug: string
}

interface Schedule {
  id: string
  name: string
  actorId: string
  actorName: string
  actorSlug?: string
  cron: string
  timezone: string
  status: string
  lastRunAt: string | null
  nextRunAt: string | null
  lastRunStatus: string | null
  input?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CRON_PRESETS = [
  { label: 'Every hour',         cron: '0 * * * *'    },
  { label: 'Every day at 9am',   cron: '0 9 * * *'    },
  { label: 'Weekdays at 9am',    cron: '0 9 * * 1-5'  },
  { label: 'Every Monday',       cron: '0 8 * * 1'    },
  { label: 'Custom',             cron: ''              },
]

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Kolkata',
  'Asia/Tokyo',
]

function humanCron(cron: string): string {
  return CRON_PRESETS.find(p => p.cron === cron)?.label ?? cron
}

function nextRunRelative(nextRunAt: string | null): string {
  if (!nextRunAt) return '—'
  const diff = new Date(nextRunAt).getTime() - Date.now()
  if (diff < 0) return 'Overdue'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h === 0) return `in ${m}m`
  if (h < 24) return `in ${h}h ${m}m`
  const d = Math.floor(h / 24)
  const rem = h % 24
  return `in ${d}d ${rem}h`
}

function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/)
  return parts.length === 5
}

// ─── Schedule Form ────────────────────────────────────────────────────────────

interface ScheduleFormProps {
  actors: Actor[]
  initial?: Partial<Schedule>
  onSubmit: (data: Record<string, string>) => Promise<void>
  onClose: () => void
  title: string
}

function ScheduleForm({ actors, initial, onSubmit, onClose, title }: ScheduleFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [actorId, setActorId] = useState(initial?.actorId ?? actors[0]?.id ?? '')
  const [cronPreset, setCronPreset] = useState(() => {
    const preset = CRON_PRESETS.find(p => p.cron === initial?.cron)
    return preset ? preset.label : 'Custom'
  })
  const [cron, setCron] = useState(initial?.cron ?? '0 9 * * 1-5')
  const [timezone, setTimezone] = useState(initial?.timezone ?? 'UTC')
  const [input, setInput] = useState(initial?.input ?? '{}')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; actorId?: string; cron?: string }>({})

  function selectPreset(label: string) {
    setCronPreset(label)
    const found = CRON_PRESETS.find(p => p.label === label)
    if (found && found.cron) setCron(found.cron)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: { name?: string; actorId?: string; cron?: string } = {}
    if (!name.trim()) newErrors.name = 'Schedule name is required.'
    if (!actorId) newErrors.actorId = 'Please select an actor.'
    if (!isValidCron(cron)) newErrors.cron = 'Cron expression must have exactly 5 parts (e.g. 0 9 * * 1-5).'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    setSaving(true)
    await onSubmit({ name, actorId, cronExpr: cron, timezone, input })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#09090b] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Schedule Name</label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })) }}
                placeholder="Daily LinkedIn Scrape"
                className={`w-full px-3 py-2 text-sm bg-white/5 border rounded-lg outline-none focus:border-violet-500 text-white placeholder:text-white/30 ${errors.name ? 'border-red-500' : 'border-white/10'}`}
                autoFocus
              />
              {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Actor</label>
              <select
                value={actorId}
                onChange={e => { setActorId(e.target.value); if (errors.actorId) setErrors(prev => ({ ...prev, actorId: undefined })) }}
                className={`w-full px-3 py-2 text-sm bg-[#09090b] border rounded-lg outline-none focus:border-violet-500 text-white ${errors.actorId ? 'border-red-500' : 'border-white/10'}`}
              >
                {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                {actors.length === 0 && <option value="">No actors found</option>}
              </select>
              {errors.actorId && <p className="text-xs text-red-400 mt-1">{errors.actorId}</p>}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Schedule Preset</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {CRON_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => selectPreset(p.label)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${cronPreset === p.label ? 'bg-violet-600 border-violet-500 text-white' : 'border-white/10 text-white/60 hover:border-white/20'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              value={cron}
              onChange={e => { setCron(e.target.value); setCronPreset('Custom'); if (errors.cron) setErrors(prev => ({ ...prev, cron: undefined })) }}
              placeholder="0 9 * * 1-5"
              className={`w-full px-3 py-2 text-sm font-mono bg-white/5 border rounded-lg outline-none focus:border-violet-500 text-white ${errors.cron ? 'border-red-500' : 'border-white/10'}`}
            />
            {errors.cron && <p className="text-xs text-red-400 mt-1">{errors.cron}</p>}
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Timezone</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#09090b] border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Input JSON</label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={4}
              placeholder='{"url": "https://...", "maxResults": 100}'
              className="w-full px-3 py-2 text-sm font-mono bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white resize-none placeholder:text-white/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : title}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [schedulesData, actorsData] = await Promise.all([
        fetch('/api/schedules').then(r => r.json()),
        fetch('/api/actors').then(r => r.json()),
      ])
      const sList: Schedule[] = (Array.isArray(schedulesData) ? schedulesData : []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        name: s.name as string,
        actorId: s.actorId as string,
        actorName: ((s.actor as Record<string, unknown>)?.name as string) ?? (s.actorId as string),
        actorSlug: ((s.actor as Record<string, unknown>)?.slug as string) ?? undefined,
        cron: (s.cronExpr as string) ?? (s.cron as string) ?? '',
        timezone: (s.timezone as string) ?? 'UTC',
        status: s.status as string,
        lastRunAt: s.lastRunAt as string | null,
        nextRunAt: s.nextRunAt as string | null,
        lastRunStatus: s.lastRunStatus as string | null,
        input: s.input as string | undefined,
      }))
      setSchedules(sList)
      setActors(Array.isArray(actorsData) ? actorsData : [])
    } catch { setSchedules([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleStatus(id: string, current: string) {
    const newStatus = current === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      fetchData()
    } catch (err) {
      showToast(`Failed to update status: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Are you sure you want to delete this schedule? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      setSchedules(prev => prev.filter(s => s.id !== id))
      showToast('Schedule deleted.')
    } catch (err) {
      showToast(`Failed to delete schedule: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function runNow(schedule: Schedule) {
    setRunningId(schedule.id)
    try {
      let inputObj = {}
      try { inputObj = JSON.parse(schedule.input ?? '{}') } catch { /* ignore */ }
      const res = await fetch('/api/runs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: schedule.actorId, input: inputObj }),
      })
      if (!res.ok) {
        let detail = `Status ${res.status}`
        try {
          const body = await res.json()
          if (body?.error) detail = body.error
          else if (body?.message) detail = body.message
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      showToast('Run enqueued!')
    } catch (err) {
      showToast(`Run failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setRunningId(null)
  }

  async function createSchedule(data: Record<string, string>) {
    await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    fetchData()
  }

  async function updateSchedule(data: Record<string, string>) {
    if (!editSchedule) return
    await fetch(`/api/schedules/${editSchedule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    fetchData()
  }

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">{toast}</div>
      )}
      {showNew && (
        <ScheduleForm actors={actors} onSubmit={createSchedule} onClose={() => setShowNew(false)} title="Create Schedule" />
      )}
      {editSchedule && (
        <ScheduleForm actors={actors} initial={editSchedule} onSubmit={updateSchedule} onClose={() => setEditSchedule(null)} title="Edit Schedule" />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-violet-400" />Schedules
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Automate actor runs on a recurring schedule</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />New Schedule
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-20 text-white/30 text-sm border border-white/10 rounded-2xl">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No schedules yet. Create one to automate actor runs.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map(sch => (
            <div key={sch.id} className="border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${sch.status === 'ACTIVE' ? 'bg-green-400' : 'bg-white/20'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="font-medium truncate">{sch.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${sch.status === 'ACTIVE' ? 'bg-green-400/10 text-green-400' : 'bg-white/5 text-white/40'}`}>
                        {sch.status}
                      </span>
                    </div>
                    <p className="text-sm text-white/50 truncate">{sch.actorName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditSchedule(sch)}
                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleStatus(sch.id, sch.status)}
                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                    title={sch.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                  >
                    {sch.status === 'ACTIVE' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => runNow(sch)}
                    disabled={runningId === sch.id}
                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                    title="Run now"
                  >
                    {runningId === sch.id
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-yellow-400" />
                      : <Zap className="h-3.5 w-3.5 text-yellow-400" />
                    }
                  </button>
                  <button
                    onClick={() => deleteSchedule(sch.id)}
                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-white/30 mb-1 flex items-center gap-1"><Clock className="h-3 w-3" />Schedule</p>
                  <p className="font-mono text-xs text-violet-300">{sch.cron}</p>
                  <p className="text-xs text-white/40 mt-0.5">{humanCron(sch.cron)}</p>
                  <p className="text-xs text-white/30 mt-0.5">{sch.timezone}</p>
                </div>
                <div>
                  <p className="text-xs text-white/30 mb-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Last Run</p>
                  <p className="text-white/70 text-xs">{sch.lastRunAt ? new Date(sch.lastRunAt).toLocaleString() : 'Never'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/30 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" />Next Run</p>
                  <p className="text-white/70 text-xs">{sch.nextRunAt ? new Date(sch.nextRunAt).toLocaleString() : '—'}</p>
                  <p className="text-xs text-white/40 mt-0.5">{nextRunRelative(sch.nextRunAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/30 mb-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Last Status</p>
                  <p className={`text-xs ${sch.lastRunStatus === 'SUCCEEDED' ? 'text-green-400' : sch.lastRunStatus === 'FAILED' ? 'text-red-400' : 'text-white/70'}`}>
                    {sch.lastRunStatus ?? '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
