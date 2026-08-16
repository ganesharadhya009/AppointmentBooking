# Directory API: Tenant, Branch, TherapyType — Design

**Status:** Approved for planning
**Date:** 2026-08-16
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` (Phase 1: Foundation & Core Ops) — this is the first domain sub-project within Phase 1, built on top of the Platform Foundation scaffold already implemented and merged.

## 1. Scope

This sub-project adds real domain logic to the `DirectoryApi` skeleton (currently just a `/health` endpoint):

- **Tenant** — create and read only. A Tenant record is created once when a new clinic-network customer is onboarded (alongside its Auth0 Organization, which is out of scope here); there is no update/delete flow yet.
- **Branch** — full CRUD.
- **TherapyType** — full CRUD, with soft delete.

**Explicitly out of scope**, deferred to a follow-on sub-project: **Therapist management**. It has a materially more complex, nested data model (branch/therapy assignments, each with up to four priced session windows, plus schedule fields) that the reference spec itself calls "the richest data model in the console" — it deserves its own focused spec/plan/build cycle rather than inflating this one.

Also out of scope (per the Phase 1 design's own phasing): Consultants, Enquiries, Holidays, and anything from Phase 2+.

## 2. Tenant Isolation

A single `ITenantContext` interface exposes `Guid TenantId` for the current request. It's resolved by a small middleware that reads an `X-Tenant-Id` header, rejecting the request with `400` (RFC 7807) if the header is missing or not a valid GUID.

This is a deliberate stand-in: no live Auth0 tenant exists yet (Platform Foundation only produced placeholder config, not an applied one), so there's no real JWT to extract a tenant claim from. When real Auth0 JWT bearer auth is wired up in a later sub-project, only this one middleware changes to read the claim from the validated token instead of a header — `ITenantContext` and everything downstream of it stays the same, because nothing else in the codebase reads the header directly.

`DirectoryDbContext` applies this tenant isolation in two places, per the parent spec's Global Constraint that tenancy is enforced in code, not by convention:
- **Reads:** a global EF Core query filter on every tenant-scoped entity — `HasQueryFilter(e => e.TenantId == _tenantContext.TenantId)` — so a query can never return another tenant's rows, even by an implementer's oversight.
- **Writes:** `TenantId` is stamped from `ITenantContext` at the point of insert, never accepted from the request body — a client cannot write into another tenant's data by supplying a different `TenantId`.

`Tenant` itself is not tenant-scoped (it *is* the tenant) and carries no query filter.

## 3. Data Model

Field-level types below are the actual EF Core property types to implement — this is the authoritative schema for this sub-project.

**`Tenant`**
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| Name | string, required, max 200 | |
| SubscriptionStatus | enum: Trial / Active / Suspended / Cancelled | default Trial |
| CreatedAt | DateTimeOffset | set server-side |

**`Branch`** (tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid (FK) | |
| Name | string, required, max 200 | |
| Address | string, max 500 | |
| Country / State / City | string, max 100 each | |
| Latitude / Longitude | double?, nullable | |
| WeeklyDayOff | enum: DayOfWeek | |
| PhotoUrl | string?, nullable | |
| IsActive | bool | default true |
| CreatedAt / CreatedBy | DateTimeOffset / string | audit columns |

**`BranchDiscountTier`** (child of Branch)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| BranchId | Guid (FK) | |
| SessionCount | int | one of 10/24/48/72/96 |
| DiscountPerSession | decimal(10,2) | Rupees |

Unique constraint on (`BranchId`, `SessionCount`). A branch always has exactly 5 rows, one per the fixed tier schedule (10/24/48/72/96 sessions) — enforced by application validation (§5), not a database constraint, since the tier *set* is fixed but the discount *amounts* are not.

**`TherapyType`** (tenant-scoped, soft-deletable)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid (FK) | |
| Name | string, required, max 200 | |
| PhotoUrl | string?, nullable | |
| Status | enum: Active / Inactive / Deleted | default Active |
| CreatedAt / CreatedBy | DateTimeOffset / string | audit columns |

**`TherapyTypeBranch`** (join table — a therapy name may attach to multiple branches, per the reference spec)
| Field | Type | Notes |
|---|---|---|
| TherapyTypeId | Guid (FK) | |
| BranchId | Guid (FK) | |

Composite PK on (`TherapyTypeId`, `BranchId`).

## 4. API

Standard REST, versionless for now (no other consumer exists yet):

| Method | Path | Notes |
|---|---|---|
| POST | `/tenants` | create |
| GET | `/tenants/{id}` | read |
| GET | `/branches` | paginated list |
| POST | `/branches` | create (body includes the 5 discount tiers) |
| GET | `/branches/{id}` | read |
| PUT | `/branches/{id}` | full update |
| DELETE | `/branches/{id}` | hard delete — `409 Conflict` if any TherapyType or Appointment still references it |
| GET | `/therapy-types` | paginated list |
| POST | `/therapy-types` | create |
| GET | `/therapy-types/{id}` | read |
| PUT | `/therapy-types/{id}` | full update |
| DELETE | `/therapy-types/{id}` | soft delete — sets Status=Deleted, row stays listed |

**Pagination:** list endpoints accept `?page=&pageSize=` (default `pageSize=20`, max `100`) and return `{ items: [...], page, pageSize, totalCount }` rather than a bare array — so adding pagination metadata later is never a breaking response-shape change.

**Validation:** request DTOs (not domain entities) carry data-annotation validation (`[Required]`, `[MaxLength]`, etc.) plus hand-written cross-field rules where annotations don't reach — specifically, a Branch's discount tiers must be exactly the 5 fixed session counts (10/24/48/72/96), each appearing once. Validation failures return `400` as an RFC 7807 Problem Details body with per-field errors, per the parent spec's Global Constraint.

## 5. Error Handling

Follows the parent spec's Global Constraint directly: every failure — validation, not-found, conflict — is an RFC 7807 Problem Details response via the existing centralized exception middleware. `404` for a missing resource, `409` for the Branch-delete-with-references case, `400` for validation and for a missing/malformed `X-Tenant-Id` header.

## 6. Testing

- **xUnit unit tests** for pure business rules that don't need a database: discount-tier validation (exactly 5, correct session counts, no duplicates), TherapyType soft-delete state transitions (Deleted is terminal — no un-delete).
- **Integration tests** against SQL Server LocalDB (confirmed installed on this machine: `MSSQLLocalDB v11.0`), a fresh database per test class via EF Core migrations. Highest-priority case: tenant isolation — two tenants' Branch/TherapyType rows are created, and a request scoped to tenant A's `X-Tenant-Id` never returns or can mutate tenant B's rows, on every endpoint.
- **Contract stability:** the pagination envelope and RFC 7807 error shape are covered by at least one integration test each, since later sub-projects (Therapist, and eventually the Admin SPA) will depend on both.

## 7. Migration to Real Auth

Tracked explicitly so it isn't lost: when Auth0 JWT bearer auth is wired up, `ITenantContext`'s implementation swaps from the `X-Tenant-Id` header middleware to reading the validated token's tenant claim. No other file in this sub-project should need to change — if implementing that swap later touches more than the middleware and its registration in `Program.cs`, that's a sign `ITenantContext` wasn't used consistently and is worth flagging at that time.
