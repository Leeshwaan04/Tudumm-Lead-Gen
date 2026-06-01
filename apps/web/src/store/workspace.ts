import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Workspace, User } from "@/types";

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  currentUser: User | null;
  sidebarCollapsed: boolean;
  mobileOpen: boolean;
  setCurrentWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentUser: (user: User | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobileOpen: () => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspace: null,
      workspaces: [],
      currentUser: null,
      sidebarCollapsed: false,
      mobileOpen: false,
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      setCurrentUser: (user) => set({ currentUser: user }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setMobileOpen: (open) => set({ mobileOpen: open }),
      toggleMobileOpen: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
      reset: () =>
        set({
          currentWorkspace: null,
          workspaces: [],
          currentUser: null,
          sidebarCollapsed: false,
          mobileOpen: false,
        }),
    }),
    {
      name: "tudumm-workspace",
      // Only persist UI prefs. currentWorkspace/currentUser must NOT persist across
      // sessions — they're re-synced from the authenticated session on each load,
      // otherwise a previous user's identity leaks into the topbar after logout/switch.
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
