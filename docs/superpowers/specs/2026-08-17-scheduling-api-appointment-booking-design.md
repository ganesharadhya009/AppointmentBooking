# Core Appointment Booking Engine — Design

**Status:** Approved for planning
**Date:** 2026-08-17
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` §3/§4/§6/§9 (Scheduling API scope, idempotency requirement). Builds `SchedulingApi` — currently a Platform Foundation health-check skeleton — into Phase 1's core value proposition: staff-initiated appointment booking.

## 1. Scope

Full appointment lifecycle on `SchedulingApi`: browse availability, book, read, list, reschedule, cancel. This is the first sub-project in the codebase to make live cross-service calls (to `DirectoryApi` and `ClientRecordsApi`) rather than staying self-contained within one service's database.

**Out of scope:** self-service (parent-facing) booking — this sub-project is staff-initiated only, per the parent spec's Phase 1 framing. Holiday-awareness (branch closures blocking availability) — deferred to Phase 2 per the roadmap; Phase 1 availability only accounts for the therapist's own schedule and existing bookings. Swap/reschedule audit logging and cancellation reporting — Phase 3 (Reporting & Financials).

## 2. Tenant-Auth Prerequisite — Resolved for This Sub-Project

`docs/superpowers/DEFERRED-AND-TODO.md` flagged that `X-Tenant-Id` is entirely client-supplied and unauthenticated, and called this out as needing resolution before Scheduling's first cross-service call. Decision: **forward the same trusted header, service-to-service.** `SchedulingApi` passes through the same `X-Tenant-Id` it received on the inbound request when calling `DirectoryApi`/`ClientRecordsApi` — no worse than the existing admin-SPA-to-service trust model, since all traffic still originates from one trusted gateway. This does not fix the platform-wide gap (real Auth0-derived tenancy remains its own future sub-project, still tracked in `DEFERRED-AND-TODO.md`); it just avoids making the gap worse by inventing a second, different unauthenticated mechanism for service-to-service calls.

## 3. The Bookable Unit

A `TherapistSessionWindow` (Morning/Noon/Afternoon/Evening, each carrying one `PricePerSession`) is the bookable unit — one appointment per Therapist + Branch + TherapyType + `WindowName` + date. This is a deliberate Phase 1 simplification: the data model prices a whole window, not a subdivided time grid, so subdividing further isn't supported by anything already built. Availability for a given date is that therapist's windows for that branch/therapy type minus whichever already have a non-cancelled appointment.

## 4. Cross-Service Validation

Booking requires all four references to resolve, same-tenant, via live HTTP calls:
- `DirectoryApi`: `GET /branches/{id}`, `GET /therapists/{id}` (to read assignments/session windows for availability and validation), and confirming the requested `TherapyTypeId` is one of that therapist's assignments at that branch.
- `ClientRecordsApi`: `GET /children/{id}`, confirming `Active` status.

These calls go through a small abstraction — `IDirectoryApiClient` / `IClientRecordsApiClient` — not raw `HttpClient` calls inline in endpoint handlers. This exists specifically so `SchedulingApi`'s own tests can substitute a fake implementation instead of requiring two other live services running during test execution. A downstream 404 or error from either dependency surfaces as a `ValidationProblem` (400), not a raw 500 — the caller made a bad reference, not a Scheduling-side failure.

## 5. Data Model

**`Appointment`** (tenant-scoped, own EF Core query filter from the first migration — the now-established convention, not something to retrofit later)

| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| BranchId | Guid | no live FK possible (different service/database) |
| TherapistId | Guid | |
| TherapyTypeId | Guid | |
| ChildId | Guid | |
| WindowName | enum: Morning/Noon/Afternoon/Evening | |
| AppointmentDate | DateOnly | |
| StartTime / EndTime | TimeOnly | denormalized from the therapist's session window at booking time |
| PricePerSession | decimal(10,2) | denormalized the same way |
| Status | enum: Planned / Completed / Cancelled | |
| IdempotencyKey | string, unique per tenant | |
| BookedBy | string | hardcoded `"system"`, matching the rest of the platform — no user identity yet |
| CreatedAt | DateTimeOffset | |

Denormalizing `StartTime`/`EndTime`/`PricePerSession` at booking time (rather than looking them up live on every read) means a later change to a therapist's schedule or pricing in `DirectoryApi` doesn't retroactively alter an already-booked appointment's recorded time/price — the correct behavior for a booking record.

## 6. API

| Method | Path | Notes |
|---|---|---|
| GET | `/availability?branchId=&therapistId=&therapyTypeId=&date=` | returns the list of open `WindowName`s for that date |
| POST | `/appointments` | requires `Idempotency-Key` header; a retried request with the same key + tenant returns the original booking, not a duplicate or an error |
| GET | `/appointments/{id}` | |
| GET | `/appointments` | paginated, `{items, page, pageSize, totalCount}` |
| PUT | `/appointments/{id}` | reschedule — re-runs the same availability check against the new date/window |
| DELETE | `/appointments/{id}` | cancels — sets `Status = Cancelled`; a cancelled appointment's slot becomes available again |

## 7. Error Handling & Idempotency

RFC 7807 throughout, matching every existing service. `POST /appointments` without an `Idempotency-Key` header returns `400`. With a key already seen for that tenant, the original appointment is returned (same status code and body as the first successful request) rather than creating a duplicate or erroring — satisfying the parent spec's Global Constraint that "duplicate bookings from naive retries are treated as a correctness bug, not an acceptable edge case."

## 8. Testing

- Unit tests for availability computation: a window is free, a window is booked (excluded), a cancelled appointment's window is free again.
- Fake-client-based tests (using the `IDirectoryApiClient`/`IClientRecordsApiClient` abstraction) proving a downstream validation failure (unknown/cross-tenant Branch, Therapist, TherapyType, or Child) returns a `ValidationProblem`, not a 500.
- Idempotency: submitting the same `Idempotency-Key` twice returns the same appointment both times, with only one row persisted.
- Tenant isolation by-ID and by-list on `Appointment`, matching every prior sub-project's coverage.
- Reschedule and cancel round-trips, including that a cancelled appointment's slot is reflected as available in a subsequent `GET /availability` call.
