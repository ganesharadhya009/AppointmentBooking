import { create } from "zustand";
import { persist } from "zustand/middleware";

// Matches DirectoryApi.Entities.StaffRole (services/directory-api/DirectoryApi/Entities/StaffMember.cs).
// The backend serializes this enum as its numeric ordinal, hence the index-based ROLE_LABELS lookup.
export const ROLE_LABELS = ["Super Admin", "Admin", "Auditor", "HR"] as const;
export type StaffRole = (typeof ROLE_LABELS)[number];

export interface AuthenticatedStaff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

interface AuthState {
  isAuthenticated: boolean;
  staff: AuthenticatedStaff | null;
  login: (staff: AuthenticatedStaff) => void;
  logout: () => void;
  updateStaff: (staff: AuthenticatedStaff) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      staff: null,
      login: (staff) => set({ isAuthenticated: true, staff }),
      logout: () => set({ isAuthenticated: false, staff: null }),
      updateStaff: (staff) => set({ staff }),
    }),
    { name: "bimba.auth" }
  )
);

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));
