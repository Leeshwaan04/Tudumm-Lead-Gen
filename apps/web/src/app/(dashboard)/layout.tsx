"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useWorkspaceStore } from "@/store/workspace";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarCollapsed, setCurrentWorkspace, setWorkspaces, setCurrentUser } = useWorkspaceStore();
  const { data: session } = useSession();

  // Sync the store with the authenticated session + real workspace on every load.
  // Prevents stale/previous-user identity from showing in the topbar.
  useEffect(() => {
    if (session?.user) {
      setCurrentUser({
        id: (session.user as { id?: string }).id ?? "",
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        avatarUrl: session.user.image ?? undefined,
      } as never);
    } else {
      setCurrentUser(null);
    }
  }, [session, setCurrentUser]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace")
      .then((r) => (r.ok ? r.json() : null))
      .then((ws) => {
        if (cancelled || !ws || ws.error) return;
        setCurrentWorkspace(ws);
        setWorkspaces([ws]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [setCurrentWorkspace, setWorkspaces]);

  return (
    <div className="flex h-screen bg-[#09090b] text-white">
      <Sidebar />
      {/* Desktop sidebar spacer — matches the fixed sidebar width */}
      <div
        className={cn(
          "hidden md:block shrink-0 transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-60"
        )}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar />
        {/* Topbar spacer */}
        <div className="h-16 shrink-0" />
        <main className="flex-1 min-h-0 flex flex-col overflow-auto">
          {children}
        </main>
      </div>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
