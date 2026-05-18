"use client";

import { useState, useEffect } from "react";
import { WorkflowBuilder } from "@/components/workflow/WorkflowBuilder";
import {
  GitBranch, Plus, Play, Trash2, Edit2, Zap,
  CheckCircle, Clock, PauseCircle, RefreshCw,
} from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  status: "ACTIVE" | "DRAFT" | "PAUSED";
  nodeCount?: number;
  lastRunAt?: string | null;
  totalRuns?: number;
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-7 w-7 animate-spin text-violet-400" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-white/10 rounded-2xl gap-4">
          <GitBranch className="h-12 w-12 text-white/10" />
          <div>
            <p className="text-white/50 font-medium">No workflows yet</p>
            <p className="text-sm text-white/30 mt-1">Build your first automated lead gen pipeline</p>
          </div>
          <button
            onClick={() => openBuilder()}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />Create Workflow
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
