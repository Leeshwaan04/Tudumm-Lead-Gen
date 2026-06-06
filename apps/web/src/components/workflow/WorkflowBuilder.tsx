"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  Handle,
  Position,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Play, GitBranch, Zap, Database, Filter, Plus, Trash2,
  Calendar, Webhook, Hand, Linkedin, Map, Mail, Brain,
  Users, Send, Globe, Star, PhoneCall, FileOutput, FileDown,
  Bell, Save, ChevronDown, ChevronUp, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Node type definitions ───────────────────────────────────────────────────

type NodeCategory = "trigger" | "action" | "condition" | "output";

interface WorkflowNodeData {
  label: string;
  description: string;
  category: NodeCategory;
  slug: string;
  configured?: boolean;
  config?: Record<string, string>;
}

const categoryConfig: Record<NodeCategory, { gradient: string; border: string; iconBg: string }> = {
  trigger:   { gradient: "from-violet-900/60 to-violet-800/40", border: "border-violet-500/40", iconBg: "bg-violet-500/20" },
  action:    { gradient: "from-blue-900/60 to-blue-800/40",     border: "border-blue-500/40",   iconBg: "bg-blue-500/20"   },
  condition: { gradient: "from-amber-900/60 to-amber-800/40",   border: "border-amber-500/40",  iconBg: "bg-amber-500/20"  },
  output:    { gradient: "from-pink-900/60 to-pink-800/40",     border: "border-pink-500/40",   iconBg: "bg-pink-500/20"   },
};

const nodeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "schedule-trigger":  Calendar,
  "webhook-trigger":   Webhook,
  "manual-trigger":    Hand,
  "scrape-linkedin":   Linkedin,
  "scrape-google-maps": Map,
  "scrape-web":        Globe,
  "find-email":        Mail,
  "apollo-enrich":     Brain,
  "ai-enrich":         Brain,
  "add-to-sequence":   Users,
  "send-webhook":      Send,
  "icp-score-filter":  Star,
  "email-found":       Mail,
  "has-phone":         PhoneCall,
  "save-to-crm":       Database,
  "export-csv":        FileDown,
  "notify-slack":      Bell,
};

const nodeTemplates: Array<{ category: NodeCategory; label: string; description: string; slug: string; group: string }> = [
  // Triggers — every workflow starts with one
  { category: "trigger", slug: "schedule-trigger",  label: "Schedule Trigger",  description: "Start automatically on a schedule (e.g. every morning)",  group: "Triggers" },
  { category: "trigger", slug: "webhook-trigger",   label: "Webhook Trigger",   description: "Start when an external app calls a URL",                   group: "Triggers" },
  { category: "trigger", slug: "manual-trigger",    label: "Manual Trigger",    description: "Start when you click Run. Good for testing.",              group: "Triggers" },
  // Actions — collect & process leads
  { category: "action", slug: "scrape-linkedin",    label: "Scrape LinkedIn",   description: "Pull profiles from a LinkedIn search. Start here for LinkedIn lead-gen (needs a connected session).", group: "Actions" },
  { category: "action", slug: "scrape-google-maps", label: "Google Maps",       description: "Pull local businesses (name, phone, site). Start here for local prospecting.", group: "Actions" },
  { category: "action", slug: "scrape-web",         label: "Scrape Web Page",   description: "Scrape any public page (directory, forum, listicle, influencer page) and AI-extract structured leads.", group: "Actions" },
  { category: "action", slug: "find-email",         label: "Find Email",        description: "Look up a verified work email. Use after scraping, before outreach.", group: "Actions" },
  { category: "action", slug: "apollo-enrich",      label: "Contact Enrich",    description: "Enrich leads with verified email, phone, title & company from our B2B directory.", group: "Actions" },
  { category: "action", slug: "ai-enrich",          label: "AI Enrich",         description: "Score how well each lead fits your ICP + write an opener. Use after scraping, before filtering.", group: "Actions" },
  { category: "action", slug: "add-to-sequence",    label: "Add to Sequence",   description: "Enroll qualified leads into automated email/DM outreach. Usually the last step.", group: "Actions" },
  { category: "action", slug: "send-webhook",       label: "Send Webhook",      description: "Push the leads to any external app (Zapier, your API).", group: "Actions" },
  // Conditions — qualify & route
  { category: "condition", slug: "icp-score-filter", label: "ICP Score Filter", description: "Keep only leads above a fit score. Use after AI Enrich to drop weak leads.", group: "Conditions" },
  { category: "condition", slug: "email-found",      label: "Email Found?",     description: "Continue only with leads that have an email. Use before email outreach.", group: "Conditions" },
  { category: "condition", slug: "has-phone",        label: "Has Phone?",       description: "Continue only with leads that have a phone. Use to build a call list.", group: "Conditions" },
  // Outputs — deliver results
  { category: "output", slug: "save-to-crm",        label: "Save to CRM",       description: "Push leads to HubSpot/Salesforce (coming soon).", group: "Outputs" },
  { category: "output", slug: "export-csv",         label: "Export CSV",        description: "Save results as a downloadable dataset.", group: "Outputs" },
  { category: "output", slug: "notify-slack",       label: "Notify Slack",      description: "Ping a Slack channel when leads are ready (needs a Slack webhook URL).", group: "Outputs" },
];

// ─── Custom Node component ───────────────────────────────────────────────────

function CustomNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const cfg = categoryConfig[d.category];
  const Icon = nodeIconMap[d.slug] ?? Zap;

  return (
    <div className={cn(
      "rounded-xl border-2 bg-gradient-to-br p-3 shadow-xl min-w-[180px] transition-all cursor-pointer",
      cfg.gradient, cfg.border,
      selected && "ring-2 ring-violet-500 ring-offset-1 ring-offset-slate-950"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !border-slate-900 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", cfg.iconBg)}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">{d.category}</span>
        {d.configured && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
      </div>
      <div className="text-sm font-medium text-white">{d.label}</div>
      <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{d.description}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !border-slate-900 !w-3 !h-3" />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

// ─── Node Config Panel ───────────────────────────────────────────────────────

function NodeConfigPanel({ node, onUpdate, onDelete }: {
  node: Node;
  onUpdate: (id: string, config: Record<string, string>) => void;
  onDelete: (id: string) => void;
}) {
  const d = node.data as WorkflowNodeData;
  const [config, setConfig] = useState<Record<string, string>>(d.config ?? {});

  const configFields: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
    "schedule-trigger":    [{ key: "cron", label: "Cron Expression", placeholder: "0 9 * * 1-5" }],
    "webhook-trigger":     [{ key: "path", label: "Webhook Path", placeholder: "/hooks/my-webhook" }],
    "scrape-linkedin":     [{ key: "url", label: "Search URL", placeholder: "https://linkedin.com/..." }, { key: "maxResults", label: "Max Results", placeholder: "100" }],
    "scrape-google-maps":  [{ key: "query", label: "Search Query", placeholder: "coffee shops in NYC" }, { key: "location", label: "Location", placeholder: "New York, NY" }],
    "scrape-web":          [{ key: "url", label: "Page URL", placeholder: "https://site.com/advisors" }, { key: "extractPrompt", label: "What to extract (AI)", placeholder: "firm names, websites & emails of stock brokers" }],
    "find-email":          [{ key: "domain", label: "Domain (optional)", placeholder: "stripe.com" }],
    "apollo-enrich":       [],
    "ai-enrich":           [{ key: "prompt", label: "Enrichment Prompt", placeholder: "Summarize company recent news..." }],
    "add-to-sequence":     [{ key: "sequenceId", label: "Sequence ID", placeholder: "seq_..." }],
    "send-webhook":        [{ key: "url", label: "Target URL", placeholder: "https://hooks.zapier.com/..." }, { key: "secret", label: "Secret Header", placeholder: "Bearer ..." }],
    "icp-score-filter":    [{ key: "minScore", label: "Min ICP Score", placeholder: "70" }],
    "save-to-crm":         [{ key: "crmType", label: "CRM Type", placeholder: "hubspot / salesforce" }],
    "notify-slack":        [{ key: "channel", label: "Slack Channel", placeholder: "#leads" }],
    "export-csv":          [{ key: "filename", label: "Filename", placeholder: "export.csv" }],
  };

  const fields = configFields[d.slug] ?? [];

  return (
    <div className="w-64 shrink-0 border-l border-white/10 flex flex-col bg-[#0d0d14]">
      <div className="p-3 border-b border-white/10">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Node Config</p>
        <p className="text-sm font-medium text-white mt-0.5">{d.label}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {fields.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-4">No config options for this node type.</p>
        ) : fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs text-white/50 mb-1">{f.label}</label>
            <input
              value={config[f.key] ?? ""}
              onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
            />
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-white/10 space-y-2">
        <button
          onClick={() => onUpdate(node.id, config)}
          className="w-full py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs font-medium transition-colors"
        >
          Apply Config
        </button>
        <button
          onClick={() => onDelete(node.id)}
          className="w-full py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}

// ─── Execution History ───────────────────────────────────────────────────────

interface Execution {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  itemsScraped: number;
}

function ExecutionHistory({ workflowId }: { workflowId?: string }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string[]>>({});

  React.useEffect(() => {
    if (!workflowId) return;
    setLoading(true);
    fetch(`/api/workflows/${workflowId}/executions`)
      .then(r => r.json())
      .then(data => setExecutions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workflowId]);

  async function viewLogs(execId: string) {
    if (expanded === execId) { setExpanded(null); return; }
    setExpanded(execId);
    if (!logs[execId]) {
      try {
        const data = await fetch(`/api/runs/${execId}/logs`).then(r => r.json());
        setLogs(prev => ({ ...prev, [execId]: Array.isArray(data) ? data.map((l: { message?: string; msg?: string }) => l.message ?? l.msg ?? String(l)) : [] }));
      } catch { setLogs(prev => ({ ...prev, [execId]: ["No logs available."] })); }
    }
  }

  const statusColor = (s: string) =>
    s === "SUCCEEDED" ? "text-green-400" : s === "RUNNING" ? "text-blue-400" : s === "FAILED" ? "text-red-400" : "text-white/40";

  function dur(start: string, end: string | null) {
    if (!end) return "Running…";
    const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  if (!workflowId) return null;

  return (
    <div className="border-t border-white/10 bg-[#0a0a0d]">
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-white/30" />
        <span className="text-xs font-medium text-white/50">Execution History</span>
        {loading && <span className="text-xs text-white/30 ml-auto">Loading…</span>}
      </div>
      <div className="max-h-48 overflow-y-auto">
        {executions.length === 0 && !loading && (
          <p className="text-xs text-white/20 text-center py-6">No executions yet.</p>
        )}
        {executions.map(ex => (
          <div key={ex.id} className="border-b border-white/5">
            <div className="flex items-center gap-3 px-4 py-2 hover:bg-white/3 transition-colors">
              <span className={`text-xs font-medium ${statusColor(ex.status)}`}>{ex.status}</span>
              <span className="text-xs text-white/30 font-mono">{ex.id.slice(0, 12)}…</span>
              <span className="text-xs text-white/30">{dur(ex.startedAt, ex.finishedAt)}</span>
              <span className="text-xs text-white/30 ml-auto">{new Date(ex.startedAt).toLocaleString()}</span>
              <button
                onClick={() => viewLogs(ex.id)}
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                Logs {expanded === ex.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
            {expanded === ex.id && (
              <div className="px-4 pb-3 bg-black/20">
                <div className="font-mono text-xs text-green-400/80 space-y-0.5 max-h-24 overflow-y-auto">
                  {(logs[ex.id] ?? ["Loading…"]).map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main WorkflowBuilder ────────────────────────────────────────────────────

interface WorkflowBuilderProps {
  workflowId?: string;
  workflowName?: string;
  readOnly?: boolean;
  onBack?: () => void;
  onSaved?: (id: string) => void;
}

export function WorkflowBuilder({ workflowId, workflowName = "", readOnly = false, onBack, onSaved }: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [name, setName] = useState(workflowName);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const idRef = useRef(workflowId);
  const [loading, setLoading] = useState(!!workflowId);

  // Load an existing workflow's name/nodes/edges onto the canvas. Without this,
  // opening a saved workflow (Edit or a cloned template) showed a blank canvas —
  // and saving would overwrite it with empty nodes (data loss).
  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    const parse = (v: unknown): any[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try { let p = JSON.parse(v); if (typeof p === "string") p = JSON.parse(p); return Array.isArray(p) ? p : []; }
        catch { return []; }
      }
      return [];
    };
    fetch(`/api/workflows/${workflowId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(wf => {
        if (cancelled || !wf || wf.error) return;
        idRef.current = wf.id;
        setName(wf.name ?? "");
        setNodes(parse(wf.nodes));
        setEdges(parse(wf.edges));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workflowId, setNodes, setEdges]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  function addNode(template: typeof nodeTemplates[number]) {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: "custom",
      position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
      data: { label: template.label, description: template.description, category: template.category, slug: template.slug, configured: false },
    };
    setNodes(nds => [...nds, newNode]);
  }

  function updateNodeConfig(id: string, config: Record<string, string>) {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, config, configured: true } } : n));
    setSelectedNode(null);
    showToast("Node configured.");
  }

  function deleteNode(id: string) {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }

  async function save() {
    if (loading) { showToast("Still loading — try again in a moment."); return; }
    if (!name.trim()) { showToast("Enter a workflow name."); return; }
    setSaving(true);
    try {
      const payload = { name, nodes: JSON.stringify(nodes), edges: JSON.stringify(edges) };
      let res: Response;
      if (idRef.current) {
        res = await fetch(`/api/workflows/${idRef.current}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        res = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      const data = await res.json();
      if (data.id) { idRef.current = data.id; onSaved?.(data.id); }
      showToast("Workflow saved.");
    } catch { showToast("Save failed."); }
    setSaving(false);
  }

  // Source/action nodes that produce nothing without these inputs — validate
  // before running so users don't get a silent 0-item run.
  const REQUIRED_CONFIG: Record<string, { key: string; label: string }[]> = {
    "scrape-google-maps": [{ key: "query", label: "Search Query" }],
    "scrape-linkedin": [{ key: "url", label: "Search URL" }],
    "scrape-web": [{ key: "url", label: "Page URL" }],
    "send-webhook": [{ key: "url", label: "Target URL" }],
    "add-to-sequence": [{ key: "sequenceId", label: "Sequence ID" }],
    "notify-slack": [{ key: "channel", label: "Slack Channel" }],
  };

  async function runWorkflow() {
    if (!idRef.current) { showToast("Save the workflow first."); return; }
    if (nodes.length === 0) { showToast("Add at least one step before running."); return; }

    // Block the run if any node is missing a required input (the #1 cause of
    // confusing empty runs). Name the node + field so the fix is obvious.
    for (const n of nodes) {
      const reqs = REQUIRED_CONFIG[(n.data as any)?.slug as string];
      if (!reqs) continue;
      const cfg = ((n.data as any)?.config ?? {}) as Record<string, string>;
      const missing = reqs.find(r => !String(cfg[r.key] ?? "").trim());
      if (missing) {
        showToast(`“${(n.data as any)?.label}” needs ${missing.label} — click the node to set it.`);
        setSelectedNode(n);
        return;
      }
    }

    setRunning(true);
    try {
      const res = await fetch(`/api/workflows/${idRef.current}/run`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      showToast("Workflow run queued! Track it in Datasets / Runs.");
    } catch { showToast("Run failed — please try again."); }
    setRunning(false);
  }

  const groups = ["Triggers", "Actions", "Conditions", "Outputs"];

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      {!readOnly && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-[#0d0d14] shrink-0">
          {onBack && (
            <button onClick={onBack} className="text-xs text-white/40 hover:text-white transition-colors">← Back</button>
          )}
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Untitled Workflow"
            className="flex-1 max-w-xs px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
          />
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:bg-white/5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={runWorkflow}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />{running ? "Starting…" : "Run"}
            </button>
          </div>
          {toast && (
            <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">
              {toast}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left palette */}
        {!readOnly && (
          <div className="w-52 shrink-0 border-r border-white/10 overflow-y-auto bg-[#0a0a0d] py-3 space-y-4">
            {groups.map(group => {
              const templates = nodeTemplates.filter(t => t.group === group);
              return (
                <div key={group}>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-wider px-3 mb-1.5">{group}</p>
                  <div className="space-y-1 px-2">
                    {templates.map(tmpl => {
                      const cfg = categoryConfig[tmpl.category];
                      const Icon = nodeIconMap[tmpl.slug] ?? Zap;
                      return (
                        <button
                          key={tmpl.slug}
                          onClick={() => addNode(tmpl)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-br",
                            cfg.gradient, cfg.border
                          )}
                        >
                          <div className={cn("flex h-6 w-6 items-center justify-center rounded-md shrink-0", cfg.iconBg)}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-white leading-tight">{tmpl.label}</div>
                            <div className="text-xs text-white/30 mt-0.5 line-clamp-1">{tmpl.description}</div>
                          </div>
                          <Plus className="h-3 w-3 text-white/20 ml-auto shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedNode(node)}
              onPaneClick={() => setSelectedNode(null)}
              fitView
              deleteKeyCode="Delete"
              className="bg-[#09090b]"
            >
              <MiniMap
                nodeColor={() => "#7c3aed"}
                style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
                maskColor="rgba(0,0,0,0.4)"
              />
              <Controls style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
            </ReactFlow>

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <GitBranch className="h-10 w-10 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/20">Click nodes in the left panel to build your workflow</p>
                </div>
              </div>
            )}
          </div>
          <ExecutionHistory workflowId={idRef.current} />
        </div>

        {/* Right config panel */}
        {selectedNode && !readOnly && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={updateNodeConfig}
            onDelete={deleteNode}
          />
        )}
      </div>
    </div>
  );
}
