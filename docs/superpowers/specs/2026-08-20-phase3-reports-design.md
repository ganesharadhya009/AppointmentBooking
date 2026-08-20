# Phase 3 Reports — Design

**Status:** Approved for planning
**Date:** 2026-08-20
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase3-reporting-financials-design.md` §1, §3 ("Reports — no new persisted entities; new query endpoints on the services that already own the data"). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §10-12.

**Review mode:** single sonnet-tier reviewer per task, no separate final whole-branch review — per the 2026-08-20 cost checkpoint (see `[[always-subagent-driven]]`). This is the lowest-risk of Phase 3's three sub-projects: pure read-only endpoints, no money movement, no new write paths.

## 1. Scope — resolved against what the platform actually has today

The parent spec's §1 lists six reports plus split/cancellation views. Checked each against what's actually built:

**Building (real data exists, pure `GET` additions):**
- Branch-scoped, date-ranged therapist appointment list — enhance existing `GET /appointments` with filters, not a new endpoint.
- Doctor appointment list — enhance existing `GET /doctor-appointments` with filters.
- Unified appointment view (therapist + doctor) — new `GET /appointments/reports/unified`, since no existing endpoint merges the two.
- Cancellation view, branch-scoped + per-child summary — new `GET /appointments/reports/cancellations`.
- Wallet transaction list, tenant-wide — new `GET /wallets/transactions` on `BillingApi` (the existing `GET /wallets/{parentId}/transactions` is scoped to one parent; a tenant-wide operational report is a different shape).
- Payment-gateway transaction list — already exists (`GET /payment-checkouts`); add date-range filters to match the other reports.

**Explicitly deferred (documented, not silently dropped) — each would need a new persisted entity, contradicting this sub-project's "no new entities" framing:**
- **OTP audit** — no OTP verification flow exists anywhere in this platform (auth is the `X-Tenant-Id` stub throughout; real Auth0 work, including any OTP step, is deferred to the project's last phase). There is no data to report on.
- **Therapist progress report** — no session-notes/progress-tracking entity exists on any service. Building the report without the underlying feature would mean fabricating a shape with nothing behind it.
- **Appointment swap/reschedule log** — `PUT /appointments/{id}`/`PUT /doctor-appointments/{id}` update the row in place today; there is no audit trail of what changed. A real reschedule log needs a new write-side entity capturing every reschedule event, which is a data-model change wired into the existing write endpoints, not a read-only report over data that already exists.

All three are added to `DEFERRED-AND-TODO.md` as concrete follow-ups once their underlying feature exists.

## 2. Service Placement

Unchanged from the parent spec: each report is a new endpoint on the service that already owns the data. No new service.

## 3. Report Shapes

**`GET /appointments`** (enhanced, `SchedulingApi`) — new optional query params: `dateFrom`, `dateTo` (`DateOnly`, inclusive range on `AppointmentDate`), `branchId` (`Guid`), `status` (`AppointmentStatus`). All optional, combine with AND. No change to the existing response shape.

**`GET /doctor-appointments`** (enhanced, `SchedulingApi`) — new optional query params: `dateFrom`, `dateTo`, `status`. No `branchId` — `DoctorAppointment` has no `BranchId` (it's tied to `ConsultantClinicId`, not `Branch`).

**`GET /appointments/reports/unified`** (new, `SchedulingApi`) — merges `Appointment` and `DoctorAppointment` into one paginated, date/status-filterable list. Each item carries a `Kind` discriminator (`Therapist`/`Doctor`) plus the fields common to both (`Id`, `ChildId`, `AppointmentDate`, `Status`, `Amount` — `PricePerSession`/`ConsultationFee` unified under one name) and the type-specific fields nullable (`BranchId`/`TherapistId`/`TherapyTypeId` for `Therapist`; `ConsultantDoctorId`/`ConsultantClinicId` for `Doctor`). Sorted by `AppointmentDate` descending across both sources — computed by fetching both filtered sets, merging in memory, and paginating the merged, sorted list (acceptable at current scale; a genuinely large dataset would need a SQL-level `UNION`, out of scope for this sub-project).

**`GET /appointments/reports/cancellations`** (new, `SchedulingApi`) — `Status == Cancelled` only, from `Appointment` (branch-scoped: optional `branchId` filter, since only therapist appointments have one) plus a `groupByChild=true` toggle that returns per-`ChildId` cancellation counts instead of the row list — a simplification of "parent-card summary": grouping by `ChildId` rather than resolving each to its `Parent` via `ClientRecordsApi`, since resolving N children to N parents would mean N cross-service calls per report request with no batch-lookup endpoint to make it one call (a real gap, tracked in `DEFERRED-AND-TODO.md` — `?ids=` batch filters were already flagged there once before). `DoctorAppointment` cancellations are out of scope for this endpoint (no `BranchId` to scope by) — a caller wanting doctor-appointment cancellations uses the enhanced `GET /doctor-appointments?status=Cancelled` instead.

**`GET /wallets/transactions`** (new, `BillingApi`) — tenant-wide (not scoped to one `parentId`, unlike the existing per-parent endpoint), paginated, filterable by `dateFrom`, `dateTo`, `type`, and optionally `parentId` (making it a superset of the existing endpoint's filtering, without replacing it — the per-parent endpoint stays, since a parent-facing UI needs exactly that scoping and shouldn't be able to see other parents' transactions by omitting a filter on a tenant-wide endpoint. This new endpoint is for staff/admin use only — same trust model as every other list endpoint on this platform today, since real role-based access is part of the deferred real-auth work).

**`GET /payment-checkouts`** (enhanced, `BillingApi`) — add `dateFrom`, `dateTo` query params to the existing endpoint (already has `status`/`parentId`).

## 4. Error Handling & Testing

RFC 7807 throughout (only relevant for pagination edge cases here — reports have no write-side validation to speak of). Per the standing 2026-08-19 test-deferral policy, no new `[Fact]` tests in this plan.
