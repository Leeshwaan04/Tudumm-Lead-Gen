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

const mockWorkspace: Workspace = {
  id: "ws_01HX4N3K7P",
  name: "Indiabulls Marketing",
  slug: "indiabulls-marketing",
  ownerId: "usr_01HX4N3K7P",
  createdAt: "2024-01-15T10:00:00Z",
  members: [
    {
      userId: "usr_01HX4N3K7P",
      role: "owner",
      user: {
        id: "usr_01HX4N3K7P",
        email: "sumit.bagewadi@indiabulls.com",
        name: "Sumit Bagewadi",
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Sumit",
        createdAt: "2024-01-15T10:00:00Z",
      },
    },
  ],
};

const mockUser: User = {
  id: "usr_01HX4N3K7P",
  email: "sumit.bagewadi@indiabulls.com",
  name: "Sumit Bagewadi",
  avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Sumit",
  createdAt: "2024-01-15T10:00:00Z",
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspace: mockWorkspace,
      workspaces: [
        mockWorkspace,
        {
          id: "ws_02HX4N3K7P",
          name: "Indiabulls Sales",
          slug: "indiabulls-sales",
          ownerId: "usr_01HX4N3K7P",
          createdAt: "2024-06-01T10:00:00Z",
          members: [],
        },
        {
          id: "ws_03HX4N3K7P",
          name: "Indiabulls Business Dev",
          slug: "indiabulls-bizdev",
          ownerId: "usr_01HX4N3K7P",
          createdAt: "2024-06-01T10:00:00Z",
          members: [],
        },
      ],
      currentUser: mockUser,
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
      partialize: (state) => ({
        currentWorkspace: state.currentWorkspace,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
