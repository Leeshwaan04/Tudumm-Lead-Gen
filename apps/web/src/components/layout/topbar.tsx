"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import {
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Building2,
  Check,
  Menu,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type Notif = { id: string; title: string; detail: string; at: string; href: string; ok: boolean };

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function Topbar() {
  const { currentWorkspace, workspaces, currentUser, setCurrentWorkspace, sidebarCollapsed, toggleMobileOpen } =
    useWorkspaceStore();
  const { data: session, status, update } = useSession();
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const headerRef = useRef<HTMLElement>(null);

  // Close any open dropdown when clicking outside the header (smoother UX).
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setWorkspacesOpen(false); setUserMenuOpen(false); setNotifOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") { setWorkspacesOpen(false); setUserMenuOpen(false); setNotifOpen(false); }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onEsc); };
  }, []);

  // Load notifications on mount + when the dropdown opens (and poll every 60s).
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setNotifLoading(true);
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => { if (!cancelled) setNotifications(Array.isArray(d.items) ? d.items : []); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setNotifLoading(false); });
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Switch the active workspace: update the session's workspaceId (validated
  // server-side), then reload so all data refetches under the new workspace.
  async function switchWorkspace(ws: { id: string; name: string }) {
    if (switching || currentWorkspace?.id === ws.id) { setWorkspacesOpen(false); return; }
    setSwitching(true);
    setSwitchingId(ws.id);
    setCurrentWorkspace(ws as never);
    await update({ workspaceId: ws.id });
    window.location.reload();
  }

  async function createWorkspace() {
    const name = newWsName.trim();
    if (!name) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("create failed");
      const ws = await res.json();
      await update({ workspaceId: ws.id });
      window.location.reload();
    } catch {
      setSwitching(false);
      alert("Could not create workspace. Please try again.");
    }
  }

  // Use session directly for instant display — no async fetch needed
  const displayName = currentUser?.name ?? session?.user?.name ?? "";
  const displayEmail = currentUser?.email ?? session?.user?.email ?? "";
  const workspaceLoading = status === "loading" || (!currentWorkspace && status === "authenticated");

  return (
    <header
      ref={headerRef}
      className={cn(
        "fixed top-0 right-0 z-30 flex h-16 items-center gap-4 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl px-4 transition-all duration-300",
        "left-0 md:left-auto",
        sidebarCollapsed ? "md:left-16" : "md:left-60"
      )}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={toggleMobileOpen}
        className="flex md:hidden items-center justify-center h-9 w-9 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Workspace Switcher */}
      <div className="relative">
        <button
          onClick={() => {
            setWorkspacesOpen(!workspacesOpen);
            setUserMenuOpen(false);
          }}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white hover:bg-white/5 transition-colors border border-white/10"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-violet-500 to-indigo-500">
            <Building2 className="h-3 w-3 text-white" />
          </div>
          {workspaceLoading ? (
            <span className="h-3.5 w-24 rounded animate-pulse bg-white/10 inline-block" />
          ) : (
            <span className="max-w-[160px] truncate">{currentWorkspace?.name ?? "My Workspace"}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {workspacesOpen && (
          <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-slate-900 shadow-2xl p-1.5 z-50 origin-top-left animate-in fade-in zoom-in-95 duration-150">
            <p className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Workspaces
            </p>
            {workspaces.map((ws) => {
              const active = currentWorkspace?.id === ws.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => switchWorkspace(ws)}
                  disabled={switching}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-white transition-colors disabled:cursor-not-allowed",
                    active ? "bg-violet-500/10" : "hover:bg-white/5",
                    switching && !active ? "opacity-40" : ""
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-bold text-white">
                    {ws.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium leading-tight">{ws.name}</div>
                    <div className="text-[11px] text-slate-400 leading-tight">{ws.plan}</div>
                  </div>
                  {switchingId === ws.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-400" />
                  ) : active ? (
                    <Check className="h-4 w-4 shrink-0 text-violet-400" />
                  ) : null}
                </button>
              );
            })}
            <div className="mt-1.5 border-t border-white/10 pt-1.5">
              <button
                onClick={() => { setWorkspacesOpen(false); setNewWsName(""); setShowCreateWs(true); }}
                disabled={switching}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-white/15">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                Create workspace
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <ThemeToggle />

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => { setNotifOpen(!notifOpen); setWorkspacesOpen(false); setUserMenuOpen(false); }}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-violet-500 border border-slate-950" />
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-1 w-80 rounded-xl border border-white/10 bg-slate-900 shadow-2xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Notifications</span>
              {notifLoading && <span className="text-xs text-white/30">Loading…</span>}
            </div>
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-white/40">
                {notifLoading ? "Checking…" : "You're all caught up 🎉"}
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setNotifOpen(false)}
                      className="flex gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                    >
                      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", n.ok ? "bg-emerald-400" : "bg-red-400")} />
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{n.title}</div>
                        {n.detail && <div className="text-xs text-white/40 truncate">{n.detail}</div>}
                        <div className="text-[11px] text-white/25 mt-0.5">{timeAgo(n.at)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => {
            setUserMenuOpen(!userMenuOpen);
            setWorkspacesOpen(false);
          }}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
            {displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="hidden sm:block text-sm text-white font-medium max-w-[100px] truncate">
            {displayName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1 z-50">
            <div className="px-3 py-2 border-b border-white/10">
              <div className="font-medium text-sm text-white">{displayName}</div>
              <div className="text-xs text-slate-400">{displayEmail}</div>
            </div>
            <Link
              href="/settings"
              onClick={() => setUserMenuOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setUserMenuOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <div className="border-t border-white/10 mt-1 pt-1">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create workspace modal (replaces window.prompt) */}
      {showCreateWs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !switching && setShowCreateWs(false)}>
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-1">Create workspace</h3>
            <p className="text-xs text-white/40 mb-4">A workspace keeps its own leads, runs, and sequences separate.</p>
            <input
              autoFocus
              value={newWsName}
              onChange={e => setNewWsName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createWorkspace(); if (e.key === "Escape") setShowCreateWs(false); }}
              placeholder="e.g. Acme Outbound"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreateWs(false)} disabled={switching} className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={createWorkspace} disabled={switching || !newWsName.trim()} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors">
                {switching ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
