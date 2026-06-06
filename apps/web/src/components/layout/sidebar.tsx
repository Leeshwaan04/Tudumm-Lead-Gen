"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TudummMark } from "@/components/brand/Logo";
import {
  LayoutDashboard,
  Ghost,
  GitBranch,
  Play,
  Store,
  Globe2,
  Database,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Linkedin,
  BookOpen,
  Sparkles,
  Megaphone,
  Users2,
  X,
  Inbox,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isNew?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/phantoms", label: "Phantoms", icon: Ghost },
  { href: "/leads", label: "Leads", icon: Users2 },
  { href: "/lead-gen", label: "Lead Gen", icon: Megaphone, isNew: true },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: "New" },
  { href: "/sequences", label: "Sequences", icon: GitBranch, isNew: true },
  { href: "/workflows", label: "Workflows", icon: GitBranch, isNew: true },
  { href: "/actors", label: "Runs", icon: Play },
  { href: "/store", label: "Store", icon: Store },
  { href: "/proxy", label: "Proxy", icon: Globe2 },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/schedules", label: "Schedules", icon: Clock },
  { href: "/playbooks", label: "Playbooks", icon: BookOpen, isNew: true },
  { href: "/linkedin", label: "LinkedIn", icon: Linkedin },
  { href: "/social", label: "Social Accounts", icon: Share2 },
  { href: "/enrichment", label: "Enrichment", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

const quickActions: NavItem[] = [
  { href: "/workflows/new", label: "New Workflow", icon: Zap },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileOpen, setMobileOpen } = useWorkspaceStore();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setMobileOpen]);

  const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-white/10 px-4 shrink-0">
        {(!sidebarCollapsed || isMobile) ? (
          <Link href="/dashboard" className="flex items-center gap-2 group flex-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25 shrink-0">
              <TudummMark className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Tudumm</span>
          </Link>
        ) : (
          <Link href="/dashboard" className="mx-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <TudummMark className="h-4 w-4 text-white" />
            </div>
          </Link>
        )}
        {/* Close button for mobile */}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {(!sidebarCollapsed || isMobile) && (
          <p className="px-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Platform
          </p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-white",
                sidebarCollapsed && !isMobile && "justify-center px-0"
              )}
              title={sidebarCollapsed && !isMobile ? item.label : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-violet-400" : "text-slate-500 group-hover:text-slate-300"
                )}
              />
              {(!sidebarCollapsed || isMobile) && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-xs bg-violet-600/30 text-violet-300 rounded-full px-1.5 py-0.5 border border-violet-500/30">
                      {item.badge}
                    </span>
                  )}
                  {item.isNew && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 rounded-full px-1.5 py-0.5 border border-emerald-500/30">
                      New
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}

        {(!sidebarCollapsed || isMobile) && (
          <div className="pt-4 pb-2">
            <p className="px-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Quick Access
            </p>
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-white/5 hover:text-white transition-all duration-150"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-slate-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <div className="border-t border-white/10 p-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn(
              "w-full text-slate-400 hover:text-white hover:bg-white/5",
              sidebarCollapsed ? "justify-center" : "justify-end"
            )}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex fixed left-0 top-0 z-40 h-screen flex-col border-r border-white/10 bg-slate-950 transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-60"
        )}
      >
        <NavContent />
      </aside>

      {/* ── Mobile backdrop ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-72 flex flex-col border-r border-white/10 bg-slate-950 transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent isMobile />
      </aside>
    </>
  );
}
