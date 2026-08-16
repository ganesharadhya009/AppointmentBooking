# Therapist Management — Design

**Status:** Approved for planning
**Date:** 2026-08-16
**Parent specs:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` (Phase 1) and `docs/superpowers/specs/2026-08-16-directory-api-tenant-branch-therapytype-design.md` (Directory API — §1 explains why Therapist was split out of that plan: a materially more complex, nested data model). This sub-project adds Therapist to the same `DirectoryApi` service that already has Tenant, Branch, and TherapyType implemented.

## 1. Scope

Full CRUD on `/therapists`, with branch/therapy assignments and their session windows embedded in the request/response body rather than exposed as separate sub-resources — the same pattern already used for Branch's discount tiers. Soft delete (`Deleted` is a terminal status), matching TherapyType.

**Explicitly out of scope:**
- **Password / login credentials.** The reference spec (BimBa-Pro REQ-MT-01) captures a therapist login (mobile, email, password) alongside profile data. This sub-project stores the identity/profile fields only — mobile number, email, license number, etc. — as plain contact/record data, not as login credentials. Building an actual therapist login is the future Auth0 sub-project's concern; storing a password field now, with no hashing/auth infrastructure in place to protect it, would be premature and risky.
- **Rich list filtering.** The reference spec (REQ-MT-04) describes filtering the therapist list by therapy, branch, status, and contact number. This sub-project ships basic pagination only (the same envelope as Branch/TherapyType); richer filtering is deferred to a later polish pass, to keep this plan comparably scoped to the prior one.

## 2. Data Model

**`Therapist`** (tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| Name | string, required, max 200 | |
| MobileNumber | string, required, max 20 | |
| Email | string, required, max 200 | |
| LicenseNumber | string, required, max 100 | |
| Gender | string, max 20 | |
| Designation | string, required, max 200 | |
| PhotoUrl | string?, nullable | |
| CertificateUrl | string?, nullable | |
| SignatureUrl | string?, nullable | |
| Status | enum: Active / Inactive / Deleted | default Active |
| CreatedAt / CreatedBy | DateTimeOffset / string | audit columns, `CreatedBy` hardcoded `"system"` (matching Branch/TherapyType — no user identity yet) |

**`TherapistAssignment`** (child of Therapist)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TherapistId | Guid (FK) | |
| BranchId | Guid (FK) | must belong to the same tenant as the therapist |
| TherapyTypeId | Guid (FK) | must belong to the same tenant as the therapist |
| JoiningDate | DateOnly | |
| WeeklyDayOff | enum: DayOfWeek | |
| LunchBreakStart | TimeOnly?, nullable | |
| LunchBreakEnd | TimeOnly?, nullable | |

A therapist must have **at least one** assignment on create — an unassigned therapist record isn't useful yet.

**`TherapistSessionWindow`** (child of Assignment)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| AssignmentId | Guid (FK) | |
| WindowName | enum: Morning / Noon / Afternoon / Evening | |
| StartTime | TimeOnly | |
| EndTime | TimeOnly | must be after StartTime |
| PricePerSession | decimal(10,2) | Rupees |

An assignment must have **1 to 4** session windows, each `WindowName` appearing at most once per assignment.

## 3. API

| Method | Path | Notes |
|---|---|---|
| GET | `/therapists` | paginated list, same `{items, page, pageSize, totalCount}` envelope as Branch/TherapyType |
| POST | `/therapists` | create; body includes the full nested `Assignments` array, each with its `SessionWindows` array |
| GET | `/therapists/{id}` | read |
| PUT | `/therapists/{id}` | full update; replaces the entire assignment graph (delete-then-insert, see §5) |
| DELETE | `/therapists/{id}` | soft delete — sets Status=Deleted, row stays listed |

## 4. Validation

Real DTO validation via the already-established `DataAnnotationsValidator` (required fields, max lengths), plus hand-written cross-field rules, all returning RFC 7807 `ValidationProblem` on failure:

- At least 1 assignment on create.
- Each assignment has 1–4 session windows, no duplicate `WindowName` within an assignment.
- Every session window's `EndTime` is after its `StartTime`.
- Every assignment's `BranchId` and `TherapyTypeId` must resolve to rows belonging to the *same tenant* — rejected explicitly (not silently dropped), the same fix already applied to TherapyType's `BranchIds` in the prior plan's final review.

## 5. Write Path: Assignment Replacement on Update

`PUT /therapists/{id}` replaces the therapist's entire assignment graph (assignments and their session windows) using the same delete-then-insert approach the prior plan's final review introduced for Branch's discount tiers — **but wrapped in an explicit database transaction**, closing the exact gap that review parked as a known, non-blocking issue on that earlier code path. Both this new write path and Branch's existing one should end up using the same transaction-wrapped shape; unifying them is a reasonable in-scope cleanup if the implementation plan finds it cheap to do, but is not required by this design.

## 6. Error Handling

Unchanged from the established pattern: `Results.Problem(...)` for 404s, `Results.ValidationProblem(...)` for validation failures, tenant isolation enforced via EF Core global query filters on `Therapist` (and transitively on `TherapistAssignment`/`TherapistSessionWindow` via the same "always reached through the tenant-filtered parent navigation" discipline already used for `BranchDiscountTier`).

## 7. Testing

- **Unit tests** for the new validators: assignment-count rule, session-window count/uniqueness/time-ordering rules.
- **Integration tests** against LocalDB: full create → read → update → soft-delete round trip; tenant isolation by-ID and by-list (the pattern the prior plan's final review specifically added for Branch and TherapyType); rejection of a cross-tenant `BranchId`/`TherapyTypeId` reference; and a test proving the transaction-wrapped assignment replacement is atomic on a mid-operation failure (mirroring the gap the prior review parked, now closed and verified rather than just fixed).
