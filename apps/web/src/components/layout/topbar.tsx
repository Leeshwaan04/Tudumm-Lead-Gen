"use client";

import React, { useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { formatCredits } from "@/lib/utils";
import {
  Bell,
  ChevronDown,
  Zap,
  LogOut,
  User,
  CreditCard,
  Settings,
  Building2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { currentWorkspace, workspaces, currentUser, creditBalance, setCurrentWorkspace, sidebarCollapsed } =
    useWorkspaceStore();
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const usagePct =
    creditBalance
      ? Math.round((creditBalance.used / creditBalance.total) * 100)
      : 0;

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-16 items-center gap-4 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl px-4 transition-all duration-300",
        sidebarCollapsed ? "left-16" : "left-60"
      )}
    >
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
          <span>{currentWorkspace?.name ?? "Select workspace"}</span>
          <span className="text-xs text-slate-400 capitalize bg-white/5 rounded px-1.5 py-0.5">
            {currentWorkspace?.plan}
          </span>
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
                onClick={() => {
                  setCurrentWorkspace(ws);
                  setWorkspacesOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-bold text-white">
                  {ws.name[0]}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{ws.name}</div>
                  <div className="text-xs text-slate-400 capitalize">{ws.plan} plan</div>
                </div>
                {currentWorkspace?.id === ws.id && (
                  <Check className="h-4 w-4 text-violet-400" />
                )}
              </button>
            ))}
            <div className="border-t border-white/10 mt-1 pt-1">
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                <Building2 className="h-4 w-4" />
                Create workspace
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Credits display */}
      {creditBalance && (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <div>
            <div className="text-xs font-semibold text-white">
              {formatCredits(creditBalance.remaining)} credits
            </div>
            <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePct > 80
                    ? "bg-red-500"
                    : usagePct > 60
                    ? "bg-amber-500"
                    : "bg-violet-500"
                )}
                style={{ width: `${100 - usagePct}%` }}
              />
            </div>
          </div>
        </div>
      )}

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
            {currentUser?.name?.[0] ?? "U"}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1 z-50">
            <div className="px-3 py-2 border-b border-white/10">
              <div className="font-medium text-sm text-white">{currentUser?.name}</div>
              <div className="text-xs text-slate-400">{currentUser?.email}</div>
            </div>
            {[
              { icon: User, label: "Profile" },
              { icon: Settings, label: "Settings" },
              { icon: CreditCard, label: "Billing" },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            <div className="border-t border-white/10 mt-1 pt-1">
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
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
