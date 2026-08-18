# Directory API — Holiday Management — Design

**Status:** Approved for planning
**Date:** 2026-08-18
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase2-front-of-house-extensions-design.md` §2-3 (service placement, data model). Phase 1's own Scheduling design spec flagged this exact gap: "holiday-awareness itself is a Phase 2 input; Phase 1 availability only accounts for therapist schedule + existing bookings."

## 1. Scope

New `Holiday` entity + CRUD (create, paginated list, delete — no update) on `DirectoryApi`, plus wiring `SchedulingApi`'s `GET /availability`, `POST /appointments`, and `PUT /appointments/{id}` (reschedule) to reject/exclude a closed branch/date. Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §09 (REQ-HOL-01 through 03).

## 2. Data Model

**`Holiday`** (DirectoryApi, tenant-scoped)

| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| BranchId | Guid (FK) | must resolve to a same-tenant `Branch`, rejected explicitly on mismatch — matching the established cross-reference pattern (e.g. `TherapyType`↔`Branch` associations) |
| Date | DateOnly | |
| Reason | string, required, max 500 | |

Unique index on `(TenantId, BranchId, Date)` — `409 Conflict` on a duplicate.

**Hard delete, not soft delete.** A deliberate deviation from `TherapyType`'s soft-delete precedent: `TherapyType` needs soft delete because `Therapist` assignments reference it and history must be preserved; `Holiday` has no downstream references by ID and no history value once removed — the reference material's only deletion scenario is "we made a data-entry error, remove it."

## 3. API

| Method | Path | Notes |
|---|---|---|
| POST | `/holidays` | create; `BranchId` validated same-tenant; `409` on duplicate `(BranchId, Date)` |
| GET | `/holidays` | paginated, filterable by `branchId` and a `from`/`to` date range — filtered by `branchId` (an ID), not BimBa's literal "searchable by branch name," matching this platform's established ID-based filter convention (e.g. `GET /therapists`'s `branchId`/`therapyTypeId` filters) rather than introducing text search anywhere in the platform |
| DELETE | `/holidays/{id}` | hard delete |
| GET | `/holidays/is-closed?branchId=&date=` | `{ isClosed: bool }` — purpose-built for `SchedulingApi`'s cross-service check; a caller needing a single boolean shouldn't have to page through the list endpoint to get one |

## 4. Cross-Service Integration (SchedulingApi)

`IDirectoryApiClient` gains `Task<bool?> IsBranchClosedAsync(Guid branchId, DateOnly date, Guid tenantId)` — nullable `bool` so a downstream call failure is distinguishable from a real `false` (not-closed) at the call site, even though both currently resolve to the same fail-open behavior below.

Wired into three places:
- **`GET /availability`** — if closed, return `200` with an empty `AvailableWindows` list (not an error) — consistent with the endpoint's existing "nothing bookable" semantics when a therapist has no open windows for a date.
- **`POST /appointments`** — if closed, `400 ValidationProblem` on `appointmentDate`, checked before the existing booking-slot conflict check (a closed branch is a more fundamental rejection reason than "already booked").
- **`PUT /appointments/{id}`** (reschedule) — same check, against the *new* `AppointmentDate`.

**Failure handling: fail open.** If the holiday check itself fails (network error, `DirectoryApi` unreachable), treat the branch as **not** closed. This matches the platform's established philosophy that a downstream dependency hiccup shouldn't break the core booking flow (the same reasoning already applied to the AI Service's suggestions endpoint and to per-therapist availability failures in Scheduling). The failure mode of "occasionally lets someone book on an actual holiday during a `DirectoryApi` outage" is a recoverable, low-stakes staff-side fixup; failing closed (blocking ALL bookings whenever this one check hiccups) would be a much worse availability regression for the entire booking system over a rarely-changing, low-stakes signal.

## 5. Error Handling & Testing

RFC 7807 throughout, matching every existing endpoint. Tests: `Holiday` CRUD + tenant isolation + duplicate-rejection on `DirectoryApi`; on `SchedulingApi`, fake-client-based tests proving `GET /availability` returns empty windows on a closed date, `POST /appointments`/`PUT /appointments/{id}` reject a closed date with `ValidationProblem`, and the fail-open behavior when the holiday-check client call itself fails.
