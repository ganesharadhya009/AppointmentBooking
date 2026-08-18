# Phase 2: Front-of-House Extensions — Design

**Status:** Approved for planning
**Date:** 2026-08-18
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` §2 (roadmap). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §03 (Activity Desk), §07 (Consultants), §08 (Enquiries), §09 (Holidays).

Same level of detail as the Phase 1 doc: this establishes scope, service placement, and data model summaries per module. Field-level specs, exact validation rules, and API tables are written per sub-project during implementation, same as Directory API/Scheduling/AI-stub each got their own detailed spec under Phase 1.

## 1. Scope

Four modules, each independent enough to be its own sub-project:

- **Holidays** (ref §09) — per-branch closure calendar. Feeds directly into `SchedulingApi`'s availability calculator, which today only accounts for a therapist's own schedule and existing bookings (a gap explicitly flagged as "Phase 2 input" in the Phase 1 spec's data model section).
- **Enquiries** (ref §08) — pre-sales lead intake: parent/child/concern capture, a draft state, and one-click conversion into a real client profile.
- **Consultants** (ref §07) — a parallel, lighter-weight catalog (service/clinic/doctor) for external consulting doctors operating out of partner clinics, plus their own appointment booking.
- **Activity Desk remainder** (ref §03) — refund approvals, therapist leave requests, and two support-ticket queues (parent-facing, therapist-facing). Manual/assisted booking (the fourth Activity Desk capability) is already built — `POST /appointments` on `SchedulingApi` covers it.

## 2. Service Placement

- **Holidays → `DirectoryApi`.** A `Holiday` entity (branch-scoped, date, reason) extends the service that already owns `Branch`. `SchedulingApi`'s `GET /availability` gains a live cross-service check against `DirectoryApi`'s holiday data, following the same `IDirectoryApiClient` pattern already established for therapist/assignment lookups — not a data copy.
- **Enquiries → `ClientRecordsApi`.** An `Enquiry` sits naturally next to `Parent`/`Child` since its entire purpose is becoming one. "Convert to client" calls the same `POST /parents`/`POST /children` endpoints that already exist, rather than a bespoke enrollment path.
- **Therapist leave requests → `DirectoryApi`.** A `LeaveRequest` entity tied to `Therapist`, with an approval workflow. Also feeds `SchedulingApi`'s availability the same way holidays do — an approved leave day should block booking exactly like a branch holiday does.
- **Consultants and refund approvals and support tickets: service placement is an open question**, resolved during each module's own sub-project brainstorm rather than pre-decided here (see §5).

## 3. Data Model Summary

**`DirectoryApi`**
- `Holiday` — TenantId, BranchId, Date, Reason
- `LeaveRequest` — TenantId, TherapistId, DateRange, Status (Pending/Approved/Rejected), ApprovedBy

**`ClientRecordsApi`**
- `Enquiry` — TenantId, draft parent fields, draft child fields, up to 6 free-text concerns, attachment references, Status, FollowUpDate, ConvertedParentId (nullable, set once converted)

**Placement TBD (Consultants, refunds, support tickets)**
- `ConsultantService` / `ConsultantClinic` / `ConsultantDoctor` — a parallel catalog to `TherapyType`/`Branch`/`Therapist`, structurally simpler (no session windows/pricing per the reference material — doctor appointments aren't priced the same way multi-session therapy packages are)
- `RefundRequest` — TenantId, AppointmentId, Amount, Status, ApprovedBy
- `SupportTicket` — TenantId, RequesterType (Parent/Therapist), Category, Title, Status, Messages

## 4. Deviations from BimBa-Pro

- **Every new entity is tenant-scoped from day one** — the now-established convention, not a retrofit.
- **Enquiry-to-client conversion reuses existing `ClientRecordsApi` endpoints** rather than BimBa's bespoke "Enrollment Number" field — unless that field has real downstream accounting significance (open question, §5), a manually-entered enrollment number isn't needed when the platform already generates its own `Parent`/`Child` IDs.
- **Refund approval in this phase is an approval-workflow only, not money movement.** BimBa's refund approval assumes a payment/wallet system already exists to actually refund against — this platform's wallet/payment gateway doesn't exist until Phase 3. `RefundRequest` records the approve/reject decision; the actual credit happens once Phase 3's wallet exists (see Phase 3 doc §4).

## 5. Open Questions (resolve during each module's sub-project brainstorm)

- **Consultant appointments — extend `SchedulingApi`'s `Appointment` with a provider-type distinction (Therapist vs. Doctor), or a separate lightweight booking concept?** Doctor consultations don't have `TherapistSessionWindow`'s multi-window/pricing complexity, so forcing them through the same entity may not fit cleanly. Needs a real design pass before building.
- **Support ticket service placement.** No existing service is an obvious fit (not directory data, not client PII, not scheduling data) — may warrant its own lightweight service, or a home decided once the module's actual read/write patterns are clearer.
- **Does BimBa's "Enrollment Number" field carry real accounting/compliance meaning**, or is it purely a legacy manual-entry habit safe to drop in favor of auto-generated IDs?
