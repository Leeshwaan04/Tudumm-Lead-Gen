"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function Topbar() {
  const { currentWorkspace, workspaces, currentUser, setCurrentWorkspace, sidebarCollapsed, toggleMobileOpen } =
    useWorkspaceStore();
  const { data: session, status, update } = useSession();
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Switch the active workspace: update the session's workspaceId (validated
  // server-side), then reload so all data refetches under the new workspace.
  async function switchWorkspace(ws: { id: string; name: string }) {
    if (switching || currentWorkspace?.id === ws.id) { setWorkspacesOpen(false); return; }
    setSwitching(true);
    setCurrentWorkspace(ws as never);
    await update({ workspaceId: ws.id });
    window.location.reload();
  }

  async function createWorkspace() {
    const name = window.prompt("Name your new workspace");
    if (!name || !name.trim()) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
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
            <span className="max-w-[120px] h-3.5 w-24 rounded animate-pulse bg-white/10 inline-block" />
          ) : (
            <span className="max-w-[120px] truncate">{currentWorkspace?.name ?? "My Workspace"}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {workspacesOpen && (
          <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1 z-50">
            <p className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Workspaces
            </p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => switchWorkspace(ws)}
                disabled={switching}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-bold text-white">
                  {ws.name[0]}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{ws.name}</div>
                  <div className="text-xs text-slate-400">{ws.plan}</div>
                </div>
                {currentWorkspace?.id === ws.id && (
                  <Check className="h-4 w-4 text-violet-400" />
                )}
              </button>
            ))}
            <div className="border-t border-white/10 mt-1 pt-1">
              <button
                onClick={createWorkspace}
                disabled={switching}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <Building2 className="h-4 w-4" />
                Create workspace
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
        <Bell className="h-4 w-4" />
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-violet-500 border border-slate-950" />
      </button>

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
    </header>
  );
}
