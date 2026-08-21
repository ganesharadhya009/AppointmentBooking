import { create } from "zustand";
import * as mock from "@/lib/mockData";
import type {
  Branch, Therapy, Therapist, Enquiry, Holiday, RefundRequest, LeaveRequest,
  Parent, ChildRecord, Poster, AppVersion, AdminUser, ConsultantService,
  ConsultantBranch, ConsultantDoctor,
} from "@/lib/types";
import { nextId } from "@/lib/utils";

interface AppState {
  branches: Branch[];
  therapies: Therapy[];
  therapists: Therapist[];
  enquiries: Enquiry[];
  holidays: Holiday[];
  refundRequests: RefundRequest[];
  leaveRequests: LeaveRequest[];
  parents: Parent[];
  children: ChildRecord[];
  posters: Poster[];
  appVersions: AppVersion[];
  adminUsers: AdminUser[];
  consultantServices: ConsultantService[];
  consultantBranches: ConsultantBranch[];
  consultantDoctors: ConsultantDoctor[];

  toggleBranchStatus: (id: number) => void;
  addBranch: (b: Omit<Branch, "id" | "createdAt">) => void;

  toggleTherapyStatus: (id: number) => void;
  addTherapy: (t: Omit<Therapy, "id" | "createdAt" | "createdBy">) => void;

  toggleTherapistStatus: (id: number) => void;
  addTherapist: (t: Omit<Therapist, "id" | "createdAt">) => void;

  addHoliday: (h: Omit<Holiday, "id">) => void;
  removeHoliday: (id: number) => void;

  updateRefundStatus: (id: number, status: RefundRequest["status"]) => void;
  updateLeaveStatus: (id: number, status: LeaveRequest["status"]) => void;

  togglePosterStatus: (id: number) => void;
  addPoster: (p: Omit<Poster, "id">) => void;

  toggleAppVersionStatus: (id: number) => void;
  addAppVersion: (v: Omit<AppVersion, "id">) => void;

  toggleAdminStatus: (id: number) => void;
  addAdminUser: (u: Omit<AdminUser, "id" | "createdAt" | "avatarColor">) => void;

  addEnquiry: (e: Omit<Enquiry, "id" | "createdAt" | "createdBy">) => void;

  toggleParentLock: (id: number) => void;
  toggleParentStatus: (id: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  branches: mock.branches,
  therapies: mock.therapies,
  therapists: mock.therapists,
  enquiries: mock.enquiries,
  holidays: mock.holidays,
  refundRequests: mock.refundRequests,
  leaveRequests: mock.leaveRequests,
  parents: mock.parents,
  children: mock.children,
  posters: mock.posters,
  appVersions: mock.appVersions,
  adminUsers: mock.adminUsers,
  consultantServices: mock.consultantServices,
  consultantBranches: mock.consultantBranches,
  consultantDoctors: mock.consultantDoctors,

  toggleBranchStatus: (id) =>
    set((s) => ({
      branches: s.branches.map((b) => (b.id === id ? { ...b, status: b.status === "Active" ? "Inactive" : "Active" } : b)),
    })),
  addBranch: (b) =>
    set((s) => ({
      branches: [{ ...b, id: nextId(), createdAt: new Date().toISOString() }, ...s.branches],
    })),

  toggleTherapyStatus: (id) =>
    set((s) => ({
      therapies: s.therapies.map((t) =>
        t.id === id ? { ...t, status: t.status === "Active" ? "Inactive" : "Active" } : t
      ),
    })),
  addTherapy: (t) =>
    set((s) => ({
      therapies: [
        { ...t, id: nextId(), createdAt: new Date().toISOString(), createdBy: "Bimba Super Admin" },
        ...s.therapies,
      ],
    })),

  toggleTherapistStatus: (id) =>
    set((s) => ({
      therapists: s.therapists.map((t) =>
        t.id === id ? { ...t, status: t.status === "Active" ? "Inactive" : "Active" } : t
      ),
    })),
  addTherapist: (t) =>
    set((s) => ({
      therapists: [{ ...t, id: nextId(), createdAt: new Date().toISOString() }, ...s.therapists],
    })),

  addHoliday: (h) => set((s) => ({ holidays: [{ ...h, id: nextId() }, ...s.holidays] })),
  removeHoliday: (id) => set((s) => ({ holidays: s.holidays.filter((h) => h.id !== id) })),

  updateRefundStatus: (id, status) =>
    set((s) => ({ refundRequests: s.refundRequests.map((r) => (r.id === id ? { ...r, status } : r)) })),
  updateLeaveStatus: (id, status) =>
    set((s) => ({ leaveRequests: s.leaveRequests.map((r) => (r.id === id ? { ...r, status } : r)) })),

  togglePosterStatus: (id) =>
    set((s) => ({
      posters: s.posters.map((p) => (p.id === id ? { ...p, status: p.status === "Active" ? "Inactive" : "Active" } : p)),
    })),
  addPoster: (p) => set((s) => ({ posters: [{ ...p, id: nextId() }, ...s.posters] })),

  toggleAppVersionStatus: (id) =>
    set((s) => ({
      appVersions: s.appVersions.map((v) =>
        v.id === id ? { ...v, status: v.status === "Active" ? "Inactive" : "Active" } : v
      ),
    })),
  addAppVersion: (v) => set((s) => ({ appVersions: [{ ...v, id: nextId() }, ...s.appVersions] })),

  toggleAdminStatus: (id) =>
    set((s) => ({
      adminUsers: s.adminUsers.map((u) =>
        u.id === id ? { ...u, status: u.status === "Active" ? "Inactive" : "Active" } : u
      ),
    })),
  addAdminUser: (u) =>
    set((s) => ({
      adminUsers: [
        { ...u, id: nextId(), createdAt: new Date().toISOString(), avatarColor: "#4f46e5" },
        ...s.adminUsers,
      ],
    })),

  addEnquiry: (e) =>
    set((s) => ({
      enquiries: [
        { ...e, id: nextId(), createdAt: new Date().toISOString(), createdBy: "Bimba Super Admin" },
        ...s.enquiries,
      ],
    })),

  toggleParentLock: (id) =>
    set((s) => ({ parents: s.parents.map((p) => (p.id === id ? { ...p, locked: !p.locked } : p)) })),
  toggleParentStatus: (id) =>
    set((s) => ({
      parents: s.parents.map((p) => (p.id === id ? { ...p, status: p.status === "Active" ? "Inactive" : "Active" } : p)),
    })),
}));
