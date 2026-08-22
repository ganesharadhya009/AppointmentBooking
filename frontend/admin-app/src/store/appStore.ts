import { create } from "zustand";
import * as mock from "@/lib/mockData";
import type {
  Branch, Therapist, RefundRequest, LeaveRequest, Parent,
} from "@/lib/types";
import { nextId } from "@/lib/utils";

// Holidays, App Versions, Admin Users, Therapy Catalog, Consultants, Multi-Therapist, Banners &
// Posters, Enquiries, and Clients & Children are no longer here -- those pages own their state
// directly against their APIs (see src/lib/apiClient.ts) instead of this mock store.
// `therapists`/`parents` stay as read-only mock lists since the Reports pages still use them for
// filter dropdowns.
interface AppState {
  branches: Branch[];
  therapists: Therapist[];
  refundRequests: RefundRequest[];
  leaveRequests: LeaveRequest[];
  parents: Parent[];

  toggleBranchStatus: (id: number) => void;
  addBranch: (b: Omit<Branch, "id" | "createdAt">) => void;

  updateRefundStatus: (id: number, status: RefundRequest["status"]) => void;
  updateLeaveStatus: (id: number, status: LeaveRequest["status"]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  branches: mock.branches,
  therapists: mock.therapists,
  refundRequests: mock.refundRequests,
  leaveRequests: mock.leaveRequests,
  parents: mock.parents,

  toggleBranchStatus: (id) =>
    set((s) => ({
      branches: s.branches.map((b) => (b.id === id ? { ...b, status: b.status === "Active" ? "Inactive" : "Active" } : b)),
    })),
  addBranch: (b) =>
    set((s) => ({
      branches: [{ ...b, id: nextId(), createdAt: new Date().toISOString() }, ...s.branches],
    })),

  updateRefundStatus: (id, status) =>
    set((s) => ({ refundRequests: s.refundRequests.map((r) => (r.id === id ? { ...r, status } : r)) })),
  updateLeaveStatus: (id, status) =>
    set((s) => ({ leaveRequests: s.leaveRequests.map((r) => (r.id === id ? { ...r, status } : r)) })),
}));
