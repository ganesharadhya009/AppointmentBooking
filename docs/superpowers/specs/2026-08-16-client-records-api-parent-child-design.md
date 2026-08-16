# Client & Child Records — Design

**Status:** Approved for planning
**Date:** 2026-08-16
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` (Phase 1) §3/§4/§6. This is the first domain sub-project for `ClientRecordsApi` — currently just a Platform Foundation health-check skeleton, separate service and separate database from `DirectoryApi`. Nothing is inherited automatically; the proven `DirectoryApi` patterns (tenant isolation, RFC 7807, `DataAnnotationsValidator`, pagination envelope) are reused deliberately, re-implemented fresh in this service's own codebase.

## 1. Scope

Full CRUD on two independent resources: `/parents` and `/children`.

**Explicitly out of scope:**
- **Bulk Excel import** (reference spec REQ-CLI-02: bulk parent onboarding via `.xls`/`.xlsx` upload with a downloadable template). File parsing, template generation, and per-row validation-with-partial-success semantics are a distinct feature deserving its own sub-project later.
- **Parent login/credentials.** Same platform-wide deferral already established for Therapist: no password field, no auth mechanism. Real login (needed eventually for the parent self-service app, Phase 5) is the future Auth0 sub-project's concern.

## 2. Why Two Independent Resources, Not Embedded

Branch's discount tiers and Therapist's assignments are embedded in their parent's create/update body because they form a fixed or atomically-submitted whole. Parent and Child don't fit that shape: the reference spec treats Parent List/Card and Children List/Card as separate top-level screens, and in real onboarding a child gets added to a parent's record incrementally over time, not as one atomic graph. `Child` therefore carries a `ParentId` foreign key and is managed through its own top-level `/children` resource, not nested inside `/parents`.

## 3. Tenant Isolation

`Child` gets its own `TenantId` column and EF Core query filter from the start — not a navigation-only relationship to `Parent`. This is a deliberate correction learned forward from this session: `BranchDiscountTier` and `TherapistAssignment` both needed their own tenant filter added *after* the fact, once it became clear they were queried directly (not only reached via a filtered parent's navigation). The reference spec's own "Active Children List" is exactly that kind of direct, top-level query pattern — `Child` is built with that in mind from day one rather than repeating the fix-later cycle.

`Parent` is tenant-scoped the same way `Branch`/`TherapyType`/`Therapist` are.

## 4. Data Model

**`Parent`** (tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| Name | string, required, max 200 | |
| MobileNumber | string, required, max 20 | |
| Email | string, required, max 200 | |
| Address | string?, max 500 | |
| City | string?, max 100 | |
| State | string?, max 100 | |
| Country | string?, max 100 | |
| Status | enum: Active / Inactive | default Active; no hard delete — DELETE sets Inactive, preserving appointment/enquiry history integrity |
| CreatedAt / CreatedBy | DateTimeOffset / string | `CreatedBy` hardcoded `"system"`, matching the rest of the platform |

**`Child`** (tenant-scoped, independently — see §3)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| ParentId | Guid (FK) | must resolve to a `Parent` in the same tenant — rejected explicitly on mismatch, not silently dropped, matching the pattern already established for Branch/TherapyType cross-references |
| Name | string, required, max 200 | |
| DateOfBirth | DateOnly, required | |
| Gender | string?, max 20 | |
| GuardianName | string?, max 200 | |
| Status | enum: Active / Inactive | same convention as Parent |
| CreatedAt / CreatedBy | DateTimeOffset / string | |

A `Parent` may exist with zero children (e.g. mid-onboarding before any child is added) — no minimum-children rule, unlike Therapist's minimum-one-assignment rule (which was justified by a therapist needing somewhere to work immediately; a parent record has no equivalent constraint).

## 5. API

| Method | Path | Notes |
|---|---|---|
| GET | `/parents` | paginated list, `{items, page, pageSize, totalCount}` envelope |
| POST | `/parents` | create |
| GET | `/parents/{id}` | read |
| PUT | `/parents/{id}` | full update |
| DELETE | `/parents/{id}` | sets Status=Inactive, row stays listed |
| GET | `/children` | paginated list |
| POST | `/children` | create; `ParentId` required, validated same-tenant |
| GET | `/children/{id}` | read |
| PUT | `/children/{id}` | full update; `ParentId` re-validated |
| DELETE | `/children/{id}` | sets Status=Inactive |

## 6. Validation & Error Handling

Real DTO validation via a `DataAnnotationsValidator` re-implemented in this service (mirroring `DirectoryApi`'s), plus a hand-written check that `ParentId` resolves to a same-tenant `Parent` before a `Child` is created or updated. Every error response is RFC 7807 via `Results.Problem(...)`/`Results.ValidationProblem(...)`, matching every existing endpoint across the platform.

## 7. Testing

- Unit tests for the `ParentId` reference-validation logic.
- LocalDB integration tests: full CRUD round-trip on both `Parent` and `Child`; tenant isolation by-ID and by-list on **both** entities from day one (not retrofitted, per §3); rejection of a cross-tenant `ParentId` on `Child` create/update.
