"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useWorkspaceStore } from "@/store/workspace";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarCollapsed } = useWorkspaceStore();

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
    </div>
  );
}
