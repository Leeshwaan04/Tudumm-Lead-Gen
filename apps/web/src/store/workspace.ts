import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Workspace, User, CreditBalance } from "@/types";

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  currentUser: User | null;
  creditBalance: CreditBalance | null;
  sidebarCollapsed: boolean;
  setCurrentWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentUser: (user: User | null) => void;
  setCreditBalance: (balance: CreditBalance) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  reset: () => void;
}

const mockWorkspace: Workspace = {
  id: "ws_01HX4N3K7P",
  name: "Acme Corp",
  slug: "acme-corp",
  plan: "growth",
  ownerId: "usr_01HX4N3K7P",
  createdAt: "2024-01-15T10:00:00Z",
  members: [
    {
      userId: "usr_01HX4N3K7P",
      role: "owner",
      user: {
        id: "usr_01HX4N3K7P",
        email: "sumitbagewadi6@gmail.com",
        name: "Sumit Bagewadi",
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Sumit",
        createdAt: "2024-01-15T10:00:00Z",
      },
    },
  ],
};

const mockUser: User = {
  id: "usr_01HX4N3K7P",
  email: "sumitbagewadi6@gmail.com",
  name: "Sumit Bagewadi",
  avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Sumit",
  createdAt: "2024-01-15T10:00:00Z",
};

const mockCreditBalance: CreditBalance = {
  total: 50000,
  used: 18420,
  remaining: 31580,
  resetDate: "2026-06-01T00:00:00Z",
  plan: "growth",
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspace: mockWorkspace,
      workspaces: [
        mockWorkspace,
        {
          id: "ws_02HX4N3K7P",
          name: "Side Project",
          slug: "side-project",
          plan: "starter",
          ownerId: "usr_01HX4N3K7P",
          createdAt: "2024-06-01T10:00:00Z",
          members: [],
        },
      ],
      currentUser: mockUser,
      creditBalance: mockCreditBalance,
      sidebarCollapsed: false,
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setCreditBalance: (balance) => set({ creditBalance: balance }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      reset: () =>
        set({
          currentWorkspace: null,
          workspaces: [],
          currentUser: null,
          creditBalance: null,
          sidebarCollapsed: false,
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
