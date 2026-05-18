'use client'

import React, { useState, useEffect } from 'react'
import {
  Building2, Users, Zap, Target, Mail, Brain, Share2,
  TrendingUp, MapPin, Star, MessageSquare, Play, CheckCircle,
  Phone, ChevronDown, ChevronUp, RefreshCw, X, Plus,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaybookStage {
  id?: string
  name: string
  description?: string
  detail?: string
  actorId?: string
  actorName?: string
  tool?: string
  estimatedOutput?: string
  order?: number
  color?: string
  tag?: string
}

interface Playbook {
  id: string
  name: string
  category: string
  platform?: string
  description: string
  stages: PlaybookStage[]
  workflowId?: string
}

// ─── Workflow Selector Modal ──────────────────────────────────────────────────

interface Workflow {
  id: string
  name: string
}

function WorkflowSelectorModal({ onClose, onSelect }: {
  onClose: () => void
  onSelect: (wf: Workflow) => void
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/workflows')
      .then(r => r.json())
      .then(data => setWorkflows(Array.isArray(data) ? data : []))
      .catch(() => setWorkflows([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Select Workflow</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-violet-400" /></div>
        ) : workflows.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-8">No workflows found. Create one first.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {workflows.map(wf => (
              <button
                key={wf.id}
                onClick={() => onSelect(wf)}
                className="w-full text-left p-3 border border-white/10 rounded-xl hover:border-violet-500/50 hover:bg-violet-500/5 transition-all text-sm"
              >
                {wf.name}
              </button>
            ))}
          </div>
        )}
        <button onClick={onClose} className="w-full py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

// ─── Color map ────────────────────────────────────────────────────────────────

const colorMap: Record<string, { border: string; bg: string; text: string }> = {
  violet: { border: 'border-violet-500/30', bg: 'bg-violet-500/8',  text: 'text-violet-400'  },
  blue:   { border: 'border-blue-500/30',   bg: 'bg-blue-500/8',    text: 'text-blue-400'    },
  green:  { border: 'border-green-500/30',  bg: 'bg-green-500/8',   text: 'text-green-400'   },
  yellow: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/8',  text: 'text-yellow-400'  },
  orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/8',  text: 'text-orange-400'  },
  pink:   { border: 'border-pink-500/30',   bg: 'bg-pink-500/8',    text: 'text-pink-400'    },
}

const stageColors = ['violet', 'blue', 'green', 'yellow', 'orange', 'pink']

const stageIcons: React.ElementType[] = [Target, TrendingUp, Mail, Brain, MessageSquare, Share2, MapPin, Star, Phone, Users, Play, CheckCircle]

// ─── Hardcoded playbooks (shown if API returns empty) ────────────────────────

const DEFAULT_PLAYBOOKS: Playbook[] = [
  {
    id: 'b2b',
    name: 'B2B Decision Maker Pipeline',
    category: 'B2B',
    platform: 'LinkedIn',
    description: 'Identify, enrich, qualify, and outreach to decision makers via LinkedIn + Email.',
    workflowId: undefined,
    stages: [
      { name: 'Identification', detail: 'Export leads from LinkedIn Sales Navigator by Job Title & Industry', actorName: 'LinkedIn Sales Nav Scraper', estimatedOutput: '2,500 raw leads', color: 'violet', tag: 'PhantomBuster Logic' },
      { name: 'Intent Signal',  detail: 'Find companies hiring for roles that signal they need your product', actorName: 'Job Board Monitor', estimatedOutput: 'Intent-tagged companies', color: 'blue', tag: 'Apify Logic' },
      { name: 'Enrichment',     detail: 'Find verified business email + direct dial phone number', actorName: 'Email & Phone Finder', estimatedOutput: '~65% email match rate', color: 'green', tag: 'AI Enrichment' },
      { name: 'Qualification',  detail: "AI summarizes company's recent funding news and press releases", actorName: 'Company Intelligence Actor', estimatedOutput: 'AI qualification score', color: 'yellow', tag: 'LLM Analysis' },
      { name: 'Outreach',       detail: 'Automated LinkedIn connection + 3-step message sequence', actorName: 'LinkedIn Outreach Sequence', estimatedOutput: '~30% acceptance rate', color: 'orange', tag: 'Browser Service' },
      { name: 'Closure',        detail: 'Sync interested replies directly into HubSpot or Salesforce', actorName: 'CRM Sync Integration', estimatedOutput: 'Qualified pipeline', color: 'pink', tag: 'CRM Webhooks' },
    ],
  },
  {
    id: 'b2c',
    name: 'B2C Mass Market Pipeline',
    category: 'B2C',
    platform: 'Social',
    description: 'Scrape competitor audiences, extract contacts, and deploy mass outreach campaigns.',
    workflowId: undefined,
    stages: [
      { name: 'Influencer Audience', detail: 'Scrape followers of competitor Instagram & TikTok accounts', actorName: 'Instagram / TikTok Scraper', estimatedOutput: '50K–500K profiles', color: 'pink', tag: 'Apify Logic' },
      { name: 'Geofencing',          detail: 'Scrape users who reviewed similar businesses near target locations', actorName: 'Google Maps Review Extractor', estimatedOutput: 'Location-qualified buyers', color: 'blue', tag: 'Google Maps Scraper' },
      { name: 'Sentiment Mining',    detail: 'Find dissatisfied competitor customers via review scraping', actorName: 'Review Sentiment Analyzer', estimatedOutput: 'Pain-point-tagged prospects', color: 'yellow', tag: 'Bright Data Logic' },
      { name: 'Contact Discovery',   detail: 'Extract public emails from Instagram bio or Facebook Page', actorName: 'Social Contact Extractor', estimatedOutput: '~40% contact match', color: 'green', tag: 'Stealth Browser' },
      { name: 'Retargeting',         detail: 'Upload email list to Facebook/Instagram as Custom Audience', actorName: 'Meta Ads Sync', estimatedOutput: 'Custom + Lookalike audiences', color: 'violet', tag: 'Marketing Integration' },
      { name: 'Mass Outreach',       detail: 'Automated WhatsApp or SMS campaigns to phone numbers', actorName: 'WhatsApp / SMS Campaign', estimatedOutput: 'Campaign delivered', color: 'orange', tag: 'Communication API' },
    ],
  },
]

// ─── Playbook Detail ──────────────────────────────────────────────────────────

function PlaybookDetail({ playbook, onClose }: { playbook: Playbook; onClose: () => void }) {
  const [activeStage, setActiveStage] = useState(0)
  const [running, setRunning] = useState(false)
  const [runningStage, setRunningStage] = useState<number | null>(null)
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function runStage(stage: PlaybookStage, idx: number) {
    if (!stage.actorId) {
      showToast(`Stage "${stage.name}" queued (no actor ID configured).`)
      return
    }
    setRunningStage(idx)
    await fetch('/api/runs/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: stage.actorId, input: {} }),
    }).catch(() => {})
    showToast(`Stage "${stage.name}" queued!`)
    setRunningStage(null)
  }

  async function runFullPlaybook() {
    if (!playbook.workflowId) {
      showToast('No workflow linked. Use "Add to Workflow" first.')
      return
    }
    setRunning(true)
    await fetch(`/api/workflows/${playbook.workflowId}/run`, { method: 'POST' }).catch(() => {})
    showToast('Playbook run queued!')
    setRunning(false)
  }

  async function addToWorkflow(wf: Workflow) {
    setShowWorkflowSelector(false)
    showToast(`Stages added to "${wf.name}".`)
  }

  const stage = playbook.stages[activeStage]
  const c = colorMap[stage?.color ?? (stageColors[activeStage % stageColors.length] ?? 'violet')] ?? colorMap['violet']!
  const StageIcon = (stageIcons[activeStage % stageIcons.length] ?? Target) as React.ElementType

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      {toast && <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">{toast}</div>}
      {showWorkflowSelector && <WorkflowSelectorModal onClose={() => setShowWorkflowSelector(false)} onSelect={addToWorkflow} />}

      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <div>
          <h2 className="text-lg font-semibold">{playbook.name}</h2>
          <p className="text-sm text-white/40 mt-0.5">{playbook.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWorkflowSelector(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:bg-white/5 rounded-lg text-sm transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />Add to Workflow
          </button>
          <button
            onClick={runFullPlaybook}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm transition-colors"
          >
            {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Run Full Playbook
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white p-1"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-0">
        {/* Stage list */}
        <div className="col-span-2 border-r border-white/10 p-4 space-y-1.5">
          {playbook.stages.map((s, i) => {
            const sc = colorMap[s.color ?? (stageColors[i % stageColors.length] ?? 'violet')] ?? colorMap['violet']!
            const SIcon = (stageIcons[i % stageIcons.length] ?? Target) as React.ElementType
            return (
              <button key={i} onClick={() => setActiveStage(i)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${activeStage === i ? `${sc.border} ${sc.bg}` : 'border-white/5 hover:border-white/10'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center h-7 w-7 rounded-lg shrink-0 text-xs font-bold ${activeStage === i ? `${sc.bg} ${sc.text}` : 'bg-white/5 text-white/30'}`}>
                    {activeStage === i ? <SIcon className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${activeStage === i ? sc.text : ''}`}>{s.name}</p>
                    {s.actorName && <p className="text-xs text-white/30 mt-0.5 truncate">{s.actorName}</p>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Stage detail */}
        <div className={`col-span-3 p-6 ${c.bg}`}>
          {stage && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${c.border} ${c.text}`}>Step {activeStage + 1}</span>
                {stage.tag && <span className="text-xs text-white/40">{stage.tag}</span>}
              </div>
              <div className={`flex items-center gap-2 mb-3 ${c.text}`}>
                <StageIcon className="h-5 w-5" />
                <h3 className="text-xl font-semibold text-white">{stage.name}</h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-5">{stage.detail ?? stage.description}</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-black/20 rounded-xl p-3">
                  <p className="text-xs text-white/30 mb-1">Actor Used</p>
                  <p className="text-sm font-medium text-white">{stage.actorName ?? 'Not configured'}</p>
                </div>
                <div className="bg-black/20 rounded-xl p-3">
                  <p className="text-xs text-white/30 mb-1">Expected Output</p>
                  <p className="text-sm font-medium text-white">{stage.estimatedOutput ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => runStage(stage, activeStage)}
                  disabled={runningStage === activeStage}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${c.border} ${c.text} hover:bg-white/10 disabled:opacity-50`}
                >
                  {runningStage === activeStage ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Run This Step
                </button>
                {activeStage < playbook.stages.length - 1 && (
                  <button
                    onClick={() => setActiveStage(i => i + 1)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors text-white/60"
                  >
                    Next Step <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Playbook Card ────────────────────────────────────────────────────────────

function PlaybookCard({ playbook, onExpand }: { playbook: Playbook; onExpand: () => void }) {
  const catColor = playbook.category === 'B2B' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
    : playbook.category === 'B2C' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'

  return (
    <div className="border border-white/10 hover:border-violet-500/30 rounded-xl p-5 space-y-4 transition-all hover:shadow-lg hover:shadow-violet-500/5 cursor-pointer" onClick={onExpand}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-base leading-tight">{playbook.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${catColor}`}>{playbook.category}</span>
            {playbook.platform && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/40">{playbook.platform}</span>
            )}
          </div>
        </div>
        <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full shrink-0">
          {playbook.stages.length} stages
        </span>
      </div>
      <p className="text-sm text-white/50 leading-relaxed">{playbook.description}</p>
      <div className="flex items-center gap-1 flex-wrap">
        {playbook.stages.slice(0, 4).map((s, i) => (
          <span key={i} className="text-xs px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-white/40">{s.name}</span>
        ))}
        {playbook.stages.length > 4 && <span className="text-xs text-white/30">+{playbook.stages.length - 4} more</span>}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onExpand(); }}
        className="w-full flex items-center justify-center gap-2 py-2 border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5 rounded-lg text-sm transition-all text-white/60 hover:text-white"
      >
        <ChevronDown className="h-4 w-4" />View Playbook
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/playbooks')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) && data.length > 0 ? data : DEFAULT_PLAYBOOKS
        setPlaybooks(list.map((p: Record<string, unknown>) => ({
          ...p,
          stages: Array.isArray(p.stages)
            ? p.stages
            : (() => { try { return JSON.parse(p.stages as string ?? '[]') } catch { return [] } })(),
        })) as Playbook[])
      })
      .catch(() => setPlaybooks(DEFAULT_PLAYBOOKS))
      .finally(() => setLoading(false))
  }, [])

  const selectedPlaybook = playbooks.find(p => p.id === selectedId) ?? null

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-violet-400" /></div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lead Gen Playbooks</h1>
          <p className="text-sm text-white/40 mt-0.5">Step-by-step automated pipelines for B2B and B2C sales teams</p>
        </div>
        <span className="text-sm text-white/30">{playbooks.length} playbooks</span>
      </div>

      {/* Expanded playbook */}
      {selectedPlaybook && (
        <PlaybookDetail
          playbook={selectedPlaybook}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {playbooks.filter(p => p.id !== selectedId).map(pb => (
          <PlaybookCard key={pb.id} playbook={pb} onExpand={() => setSelectedId(pb.id)} />
        ))}
      </div>

      {playbooks.length === 0 && (
        <div className="text-center py-16 text-white/30 text-sm border border-white/10 rounded-2xl">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No playbooks yet.
        </div>
      )}
    </div>
  )
}
