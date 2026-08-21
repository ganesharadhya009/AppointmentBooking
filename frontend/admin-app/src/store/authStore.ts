import { create } from "zustand";

export type UserType = "Admin" | "Therapist" | "Auditor" | "HR";

interface AuthState {
  isAuthenticated: boolean;
  name: string;
  userType: UserType | null;
  login: (identifier: string, userType: UserType) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  name: "Bimba Super Admin",
  userType: null,
  login: (_identifier, userType) => set({ isAuthenticated: true, userType, name: "Bimba Super Admin" }),
  logout: () => set({ isAuthenticated: false, userType: null }),
}));

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
