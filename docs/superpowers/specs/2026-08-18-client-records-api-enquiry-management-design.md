# Client Records API — Enquiry Management — Design

**Status:** Approved for planning
**Date:** 2026-08-18
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase2-front-of-house-extensions-design.md` §2-3. Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §08 (REQ-ENQ-01 through 06).

## 1. Scope

Pre-sales lead intake on `ClientRecordsApi`: capture a prospective family's details, hold them in a draft/submitted state, and convert to a real `Parent`+`Child` in one action. Staff-facing only — the reference material's "shareable public Enquiry Form Link" (REQ-ENQ-04, unauthenticated self-submission) is **out of scope here**, for the same reason Phase 5's parent self-service is flagged as unresolved: a public, unauthenticated submission needs real per-tenant caller identification that doesn't exist yet (the `X-Tenant-Id` trust model assumes the caller is already the trusted admin SPA). Building it now would mean either faking tenant identification for public internet traffic (unsafe) or blocking on real auth (which is explicitly deferred to the project's last phase). Deferred, not silently dropped.

## 2. Data Model

**`Enquiry`** (ClientRecordsApi, tenant-scoped)

| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| ParentName | string, required | |
| ParentMobileNumber | string, required | |
| ParentEmail | string? | |
| ChildName | string, required | |
| ChildDateOfBirth | DateOnly? | nullable per the established `[Required]`-on-value-type lesson, even though it's conceptually required at submission time — enforced in the app validator, not the type system, since a Draft is allowed to be incomplete |
| ChildGender | string? | |
| PreferredTherapy | string? | free text, not a `TherapyTypeId` FK — at enquiry stage this is a family's stated preference, not yet a validated catalog reference |
| PreferredLocation | string? | free text, same reasoning |
| Address / City / State / Country | string? | mirrors `Parent`'s existing address fields |
| Concerns | `List<string>`, max 6 | stored as a JSON-serialized column via an EF Core value converter — no existing entity in this codebase persists a primitive list, this is the first; a value converter is simpler than a child table for a small, bounded, un-queried text blob |
| DiagnosisReportUrl / ParentIdCardUrl | string? | URL references only, no upload/storage logic — matches the existing precedent (`Therapist.PhotoUrl`/`CertificateUrl` are plain string URL fields with no backend upload handling) |
| Status | enum: Draft / Submitted / Converted | |
| FollowUpDate | DateTimeOffset? | |
| ConvertedParentId | Guid? | set only by the convert action |
| ConvertedChildId | Guid? | set only by the convert action |
| CreatedAt / CreatedBy | DateTimeOffset / string | `CreatedBy` hardcoded `"system"`, matching the platform |

## 3. API

| Method | Path | Notes |
|---|---|---|
| POST | `/enquiries` | create; `Status` defaults to `Draft` unless the request explicitly sets `Submitted` |
| GET | `/enquiries` | paginated, filterable by `status` and a `from`/`to` range on `CreatedAt`, and by `contactNumber` (exact match on `ParentMobileNumber`) — BimBa's list is also filterable by branch and creator, both dropped for this pass since neither concept exists yet on `Enquiry` (no branch is chosen until conversion; no staff-user identity model exists on this platform yet) |
| GET | `/enquiries/{id}` | read |
| PUT | `/enquiries/{id}` | update draft fields / follow-up date; `Status` may only be set to `Draft` or `Submitted` — attempting to set `Converted` directly is rejected, matching the precedent of `TherapyType` rejecting a direct reactivation from `Deleted` via `PUT` |
| POST | `/enquiries/{id}/convert` | creates a `Parent` + `Child` from the enquiry's captured fields, sets `Status = Converted`, `ConvertedParentId`, `ConvertedChildId` |

## 4. Conversion Mechanics

No cross-service call needed — `Enquiry`, `Parent`, and `Child` all live in the same service and the same `ClientRecordsDbContext`. The convert action stages all three entity changes (new `Parent`, new `Child` linked to it, the `Enquiry` update) and commits them in a single `SaveChangesAsync()` call, which EF Core already wraps in an implicit atomic transaction — no explicit `BeginTransactionAsync`/execution-strategy handling needed here, since (unlike Scheduling's booking-conflict retry scenario) there's no multi-step external call or optimistic-conflict retry in the middle of this operation.

Enrollment Number (REQ-ENQ-05's bespoke manual field) is dropped in favor of the platform's own auto-generated `Parent`/`Child` IDs, per the Phase 2 doc's already-stated leaning — no evidence in the reference material that this field carries downstream accounting significance beyond being a manual identifier BimBa's own generated IDs could serve equally well.

Converting an already-`Converted` enquiry is rejected (`409 Conflict`) — not idempotent, since a second conversion would create a second, duplicate `Parent`/`Child` pair.

## 5. Error Handling & Testing

RFC 7807 throughout. Tests: CRUD + tenant isolation on `Enquiry`; `PUT` rejecting a direct `Converted` status set; convert creating exactly one `Parent`+`Child` pair with fields correctly mapped from the enquiry; a second convert attempt on an already-converted enquiry returning `409`; the `Concerns` list round-tripping correctly through the JSON value converter (including the empty-list and null cases).
