# Activity Desk Remainder — Design

**Status:** Approved for planning
**Date:** 2026-08-19
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase2-front-of-house-extensions-design.md` §1, §5 (this was the one Phase 2 item left with genuinely open placement questions — resolved here). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §03 (REQ-ACT-01 through 03; manual booking, REQ-ACT-04, is already built).

This closes out Phase 2's backend scope.

## 1. Scope

Three independent sub-features, each its own implementation plan:

- **Refund approvals** (REQ-ACT-01) — a queue of appointments cancelled with a pending refund, with approve/reject actions.
- **Therapist leave requests** (REQ-ACT-02) — leave requests awaiting admin approval, which also block booking on approved leave days (the same shape as Phase 2's `Holiday` feature).
- **Support tickets** (REQ-ACT-03) — two independent queues (parent-facing, therapist-facing).

## 2. Service Placement (resolved)

- **`RefundRequest` → `SchedulingApi`.** It references an already-cancelled appointment (either a therapist `Appointment` or a `DoctorAppointment`, both owned by `SchedulingApi`) and has no natural home anywhere else — same reasoning that put `Holiday` in `DirectoryApi` because it's tightly coupled to `Branch`. This is an **approval-workflow entity only, not money movement** — the actual refund credit happens once `BillingApi` exists (Phase 3), matching the original Phase 2 doc's §4 framing.
- **`LeaveRequest` → `DirectoryApi`.** Already resolved in the original Phase 2 doc — tied to `Therapist`, and feeds `SchedulingApi`'s availability the same way `Holiday` does. Built as a near-exact structural mirror of the `Holiday` sub-project (same fail-open cross-service check pattern, same DB-level design).
- **`SupportTicket` → `DirectoryApi`, resolved now.** Neither queue is naturally Directory data (not a catalog), Client PII (no sensitive health/financial data, just a conversation thread), or Scheduling data. The determining factor: `DirectoryApi` is already the established home for other back-office/operational admin concerns not tied to a specific sensitive domain — the Phase 4 design doc already plans to put `Banner`/`Poster`/`AppVersion` there for exactly this reason ("low-complexity, low-sensitivity, content-management concerns... avoids unnecessary microservice sprawl"). Support tickets fit that same profile: administrative, not sensitive, not worth a dedicated service. The two queues (parent-facing, therapist-facing) share one `SupportTicket` table with a `RequesterType` discriminator rather than two separate tables — same underlying workflow (title/category/status/messages), differing only in who's on the other end.

## 3. Data Model

**`RefundRequest`** (SchedulingApi, tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| AppointmentType | enum: TherapistAppointment / DoctorAppointment | discriminates which table `AppointmentId` refers to |
| AppointmentId | Guid | validated same-service against `Appointment` or `DoctorAppointment` depending on `AppointmentType` |
| Amount | decimal(10,2) | |
| Status | enum: Pending / Approved / Rejected | |
| ApprovedBy | string? | hardcoded `"system"` once acted on, matching the platform's no-user-identity convention |
| CreatedAt | DateTimeOffset | |

Created explicitly by staff after a cancellation (`POST /refund-requests`), not auto-triggered by `DELETE /appointments/{id}`/`DELETE /doctor-appointments/{id}` — keeps the booking endpoints' contract unchanged and matches the reference material's framing of refund approval as its own distinct queue, not an automatic side effect.

**`LeaveRequest`** (DirectoryApi, tenant-scoped) — structurally identical to `Holiday`, with a date range instead of a single date
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| TherapistId | Guid (FK) | validated same-tenant, same-service |
| StartDate / EndDate | DateOnly | |
| Status | enum: Pending / Approved / Rejected | |
| ApprovedBy | string? | |
| CreatedAt | DateTimeOffset | |

**`SupportTicket`** + **`SupportTicketMessage`** (DirectoryApi, tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| RequesterType | enum: Parent / Therapist | |
| RequesterId | Guid | **not FK-validated**, deliberately — a `Parent` lives in a different service/database (can't validate same-service) and a `Therapist` could (lives in `DirectoryApi`), but applying FK rigor to one requester type and not the other would be an inconsistent, confusing asymmetry; a support ticket's core value is the conversation thread, not strict referential integrity to the requester record |
| Category | string, required | |
| Title | string, required | |
| Status | enum: WaitingForAdminReply / WaitingForUserReply / Closed | |
| CreatedAt | DateTimeOffset | |

`SupportTicketMessage`: Id, TenantId, SupportTicketId (FK, same-service), SenderType (string: "Admin" or the requester's role), Body, CreatedAt.

## 4. API

**`SchedulingApi`**
| Method | Path | Notes |
|---|---|---|
| POST / GET | `/refund-requests` | create, paginated list filterable by `status` |
| POST | `/refund-requests/{id}/approve` | `Status → Approved`, `ApprovedBy = "system"` |
| POST | `/refund-requests/{id}/reject` | `Status → Rejected`, `ApprovedBy = "system"` |

**`DirectoryApi`**
| Method | Path | Notes |
|---|---|---|
| POST / GET | `/leave-requests` | create, paginated list filterable by `therapistId`/`status` |
| POST | `/leave-requests/{id}/approve` | `Status → Approved` |
| POST | `/leave-requests/{id}/reject` | `Status → Rejected` |
| GET | `/leave-requests/is-on-leave?therapistId=&date=` | `{ isOnLeave: bool }` — mirrors `Holiday`'s `is-closed` endpoint exactly, for `SchedulingApi`'s cross-service check |
| POST / GET | `/support-tickets` | create, paginated list filterable by `requesterType`/`status` |
| GET | `/support-tickets/{id}` | includes messages |
| POST | `/support-tickets/{id}/messages` | add a message; if sent by the requester, `Status → WaitingForAdminReply`; if by admin, `Status → WaitingForUserReply` |
| POST | `/support-tickets/{id}/close` | `Status → Closed` |

**`SchedulingApi` cross-service integration:** `IDirectoryApiClient` gains `IsTherapistOnLeaveAsync(Guid therapistId, DateOnly date, Guid tenantId)`, wired into `GET /availability`, `POST /appointments`, `PUT /appointments/{id}` — the exact same three call sites and fail-open failure handling as `IsBranchClosedAsync`. Not wired into `DoctorAppointment`'s endpoints, since leave applies to `Therapist`, not `ConsultantDoctor`.

## 5. Error Handling & Testing

RFC 7807 throughout. `LeaveRequest`'s cross-service wiring is tested exactly like `Holiday`'s was: fail-open on a downstream failure, correct exclusion in availability/booking/reschedule on an approved leave day. `RefundRequest`/`SupportTicket` get standard CRUD + tenant isolation + status-transition test coverage matching every prior sub-project's shape.
