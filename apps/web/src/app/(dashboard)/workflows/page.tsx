"use client";

import { useState, useEffect } from "react";
import { WorkflowBuilder } from "@/components/workflow/WorkflowBuilder";
import {
  GitBranch, Plus, Play, Trash2, Edit2, Zap,
  CheckCircle, Clock, PauseCircle, RefreshCw, MapPin, Mail, Linkedin, Send,
} from "lucide-react";
import { HelpTip } from "@/components/ui/HelpTip";

interface Workflow {
  id: string;
  name: string;
  status: "ACTIVE" | "DRAFT" | "PAUSED";
  nodeCount?: number;
  lastRunAt?: string | null;
  totalRuns?: number;
}

// ─── Outcome-named templates: clone into a working pipeline in one click ──────
type Step = { slug: string; label: string; category: string; config?: Record<string, string> };
type Template = { key: string; name: string; outcome: string; gives: string; icon: any; steps: Step[] };

const TEMPLATES: Template[] = [
  {
    key: "local-prospecting", name: "Local Business Prospecting", icon: MapPin,
    outcome: "Build a call/email list of local businesses from Google Maps.",
    gives: "name, address, phone, website",
    steps: [
      { slug: "scrape-google-maps", label: "Google Maps", category: "action" },
      { slug: "has-phone", label: "Has Phone?", category: "condition" },
      { slug: "export-csv", label: "Export CSV", category: "output", config: { filename: "local-leads" } },
    ],
  },
  {
    key: "find-and-email", name: "Find & Email B2B Leads", icon: Mail,
    outcome: "Scrape prospects, score fit, and auto-enroll the best into outreach.",
    gives: "qualified leads enrolled in a sequence",
    steps: [
      { slug: "scrape-google-maps", label: "Google Maps", category: "action" },
      { slug: "ai-enrich", label: "AI Enrich", category: "action" },
      { slug: "icp-score-filter", label: "ICP Score Filter", category: "condition", config: { minScore: "70" } },
      { slug: "add-to-sequence", label: "Add to Sequence", category: "action" },
    ],
  },
  {
    key: "linkedin-enrich", name: "LinkedIn Lead Enrichment", icon: Linkedin,
    outcome: "Pull a LinkedIn profile, score it, and export. (Needs a connected LinkedIn session.)",
    gives: "enriched profiles with ICP score",
    steps: [
      { slug: "scrape-linkedin", label: "Scrape LinkedIn", category: "action" },
      { slug: "ai-enrich", label: "AI Enrich", category: "action" },
      { slug: "icp-score-filter", label: "ICP Score Filter", category: "condition", config: { minScore: "75" } },
      { slug: "export-csv", label: "Export CSV", category: "output", config: { filename: "linkedin-leads" } },
    ],
  },
  {
    key: "scrape-notify", name: "Scrape & Push to Your App", icon: Send,
    outcome: "Scrape a page, enrich, and POST the results to any external app.",
    gives: "structured data sent to your webhook",
    steps: [
      { slug: "scrape-web", label: "Scrape Web", category: "action" },
      { slug: "ai-enrich", label: "AI Enrich", category: "action" },
      { slug: "send-webhook", label: "Send Webhook", category: "action" },
    ],
  },
];

function buildGraph(steps: Step[]) {
  const nodes = steps.map((s, i) => ({
    id: `n${i + 1}`,
    type: "custom",
    position: { x: 280, y: 80 + i * 130 },
    data: { label: s.label, description: "", category: s.category, slug: s.slug, config: s.config ?? {}, configured: !!s.config },
  }));
  const edges = steps.slice(1).map((_, i) => ({ id: `e${i}`, source: `n${i + 1}`, target: `n${i + 2}` }));
  return { nodes, edges };
}

function statusBadge(status: string) {
  if (status === "ACTIVE")
    return <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3 w-3" />Active</span>;
  if (status === "PAUSED")
    return <span className="flex items-center gap-1 text-xs text-yellow-400"><PauseCircle className="h-3 w-3" />Paused</span>;
  return <span className="flex items-center gap-1 text-xs text-white/40"><Clock className="h-3 w-3" />Draft</span>;
}

export default function WorkflowsPage() {
  const [view, setView] = useState<"list" | "builder">("list");
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchWorkflows() {
    setLoading(true);
    try {
      const data = await fetch("/api/workflows").then(r => r.json());
      setWorkflows(Array.isArray(data) ? data : []);
    } catch { setWorkflows([]); }
    setLoading(false);
  }

  useEffect(() => { fetchWorkflows(); }, []);

  async function runWorkflow(id: string) {
    setRunningId(id);
    try {
      const res = await fetch(`/api/workflows/${id}/run`, { method: "POST" });
      if (!res.ok) {
        let detail = `Status ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) detail = body.error;
          else if (body?.message) detail = body.message;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      showToast("Run queued!");
    } catch (err) {
      showToast(`Run failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setRunningId(null);
  }

  async function deleteWorkflow(id: string) {
    if (!confirm("Are you sure you want to delete this workflow? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setWorkflows(prev => prev.filter(w => w.id !== id));
      showToast("Workflow deleted.");
    } catch (err) {
      showToast(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setDeletingId(null);
  }

  function openBuilder(id?: string) {
    setEditId(id);
    setView("builder");
  }

  const [creatingTpl, setCreatingTpl] = useState<string | null>(null);
  async function createFromTemplate(t: Template) {
    setCreatingTpl(t.key);
    try {
      const { nodes, edges } = buildGraph(t.steps);
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: t.name, nodes: JSON.stringify(nodes), edges: JSON.stringify(edges) }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const wf = await res.json();
      openBuilder(wf.id);
    } catch (err) {
      showToast(`Couldn't create from template: ${err instanceof Error ? err.message : "error"}`);
      setCreatingTpl(null);
    }
  }

  if (view === "builder") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <WorkflowBuilder
          workflowId={editId}
          onBack={() => { setView("list"); fetchWorkflows(); }}
          onSaved={id => setEditId(id)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-violet-400" />Workflows
            <HelpTip
              text="Workflows chain steps into an automated lead pipeline — scrape, enrich, filter, then email or export. Build once; it runs for every lead."
              example="Google Maps → AI Enrich → keep ICP 70+ → Add to Sequence"
            />
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Automate multi-step lead generation pipelines</p>
        </div>
        <button
          onClick={() => openBuilder()}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />New Workflow
        </button>
      </div>

      {/* Templates gallery — teaches use cases + gives a one-click running start */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white/80">Start from a template</h2>
          <p className="text-xs text-white/40 mt-0.5">Pick a goal — we&apos;ll build the pipeline. You just fill in your target and hit Run.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TEMPLATES.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => createFromTemplate(t)}
                disabled={creatingTpl !== null}
                className="text-left border border-white/10 hover:border-violet-500/40 hover:bg-white/[0.02] rounded-xl p-4 transition-colors disabled:opacity-50 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
                    {creatingTpl === t.key ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-violet-300" /> : <Icon className="h-3.5 w-3.5 text-violet-300" />}
                  </div>
                  <span className="text-sm font-medium text-white">{t.name}</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{t.outcome}</p>
                <div className="mt-auto pt-1 flex items-center gap-1 flex-wrap">
                  {t.steps.map((s, i) => (
                    <span key={i} className="text-[10px] text-white/40">
                      {s.label}{i < t.steps.length - 1 ? " →" : ""}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-violet-300/70">Gives you: {t.gives}</p>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-7 w-7 animate-spin text-violet-400" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-white/10 rounded-2xl gap-4">
          <GitBranch className="h-12 w-12 text-white/10" />
          <div>
            <p className="text-white/50 font-medium">No saved workflows yet</p>
            <p className="text-sm text-white/30 mt-1">Pick a template above, or build one from scratch.</p>
          </div>
          <button
            onClick={() => openBuilder()}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />Build from scratch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map(wf => (
            <div key={wf.id} className="border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="font-semibold truncate">{wf.name}</h3>
                    {statusBadge(wf.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/40 flex-wrap">
                    {wf.nodeCount !== undefined && (
                      <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{wf.nodeCount} nodes</span>
                    )}
                    {wf.totalRuns !== undefined && (
                      <span className="flex items-center gap-1"><Play className="h-3 w-3" />{wf.totalRuns} runs</span>
                    )}
                    {wf.lastRunAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />Last run {new Date(wf.lastRunAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-auto">
                <button
                  onClick={() => openBuilder(wf.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:bg-white/5 rounded-lg text-sm transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />Edit
                </button>
                <button
                  onClick={() => runWorkflow(wf.id)}
                  disabled={runningId === wf.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {runningId === wf.id
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <Play className="h-3.5 w-3.5" />
                  }
                  Run
                </button>
                <button
                  onClick={() => deleteWorkflow(wf.id)}
                  disabled={deletingId === wf.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {deletingId === wf.id
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
