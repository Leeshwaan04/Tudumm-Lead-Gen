"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, Clock, CheckCircle2, XCircle, Loader2, Ban, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatDateTime, formatCredits } from "@/lib/utils";
import type { Run, RunStatus } from "@/types";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: RunStatus }) {
  const map: Record<RunStatus, { label: string; variant: "success" | "destructive" | "running" | "warning" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
    succeeded: { label: "Succeeded", variant: "success", icon: CheckCircle2 },
    failed: { label: "Failed", variant: "destructive", icon: XCircle },
    running: { label: "Running", variant: "running", icon: Loader2 },
    queued: { label: "Queued", variant: "warning", icon: Clock },
    aborted: { label: "Aborted", variant: "outline", icon: Ban },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" as const, icon: HelpCircle };
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit">
      <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
      {cfg.label}
    </Badge>
  );
}

interface RunsTableProps {
  runs: Run[];
  showActor?: boolean;
}

export function RunsTable({ runs, showActor = true }: RunsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Run ID
            </th>
            {showActor && (
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Actor
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Started
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Items
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Credits
            </th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-white/5 transition-colors group">
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-slate-400">{run.id.slice(0, 14)}…</span>
              </td>
              {showActor && (
                <td className="px-4 py-3">
                  <span className="font-medium text-white">{run.actorName}</span>
                </td>
              )}
              <td className="px-4 py-3">
                <StatusBadge status={run.status} />
              </td>
              <td className="px-4 py-3 text-slate-400">{formatDateTime(run.startedAt)}</td>
              <td className="px-4 py-3 text-right text-slate-400">
                {run.durationMs ? formatDuration(run.durationMs) : "—"}
              </td>
              <td className="px-4 py-3 text-right text-slate-300">
                {run.itemsScraped?.toLocaleString() ?? "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="flex items-center justify-end gap-1 text-amber-400">
                  {formatCredits(run.creditsUsed)}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/actors/${run.actorId}/runs/${run.id}`}
                  className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {runs.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-slate-500">No runs yet. Launch an actor to get started.</p>
        </div>
      )}
    </div>
  );
}
