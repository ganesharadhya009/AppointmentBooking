# DirectoryApi Banners, Posters & App Version — Design

**Status:** Approved for planning
**Date:** 2026-08-20
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase4-platform-marketing-design.md` §1-4. Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §14-15.

**Scope decision (user, 2026-08-20):** Phase 4 also includes Admin User Management (blocked on real auth per the parent spec's own framing) and Tenant billing/onboarding (needs a self-serve-vs-sales-assisted business decision). Both deferred — see `DEFERRED-AND-TODO.md`. This sub-project covers only the unblocked, no-business-decision-needed piece: Banners, Posters, App Version.

**Review mode:** single sonnet-tier reviewer per task, no separate final whole-branch review — per the 2026-08-20 cost checkpoint. Low-risk: simple CRUD, one service, no cross-service calls, no money, no concurrency-sensitive writes.

## 1. Data Model

**`Banner`** (`DirectoryApi`, tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| ImageUrl | string, required | |
| WatermarkTitle | string, required | |
| CreatedAt | DateTimeOffset | |

**`Poster`** (`DirectoryApi`, tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| Type | string, required | free-form (promotional/announcement/etc.) — no fixed vocabulary specified in the parent spec, kept open like `SupportTicket.Category` |
| Position | enum: Top / Bottom / Popup | per parent spec §3 |
| ActiveFrom / ActiveTo | DateOnly | inclusive display window |
| Priority | int | higher shows first when multiple posters are active simultaneously |
| IsActive | bool | manual on/off, independent of the date window |
| CreatedAt | DateTimeOffset | |

**`AppVersion`** (`DirectoryApi`, **platform-scoped — no `TenantId`, no query filter**, per parent spec §4)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TargetApp | enum: AdminSpa / ParentApp / StaffApp | the three client apps in this platform's roadmap |
| VersionNumber | string, required | e.g. `"1.2.3"` |
| ReleaseStatus | enum: Draft / Published / Deprecated | |
| RequireUpdate | bool | forced-update flag |
| ReleaseDate | DateOnly | |
| CreatedAt | DateTimeOffset | |

Modeled exactly like the existing `Tenant` entity — no `TenantId` column, no `HasQueryFilter`. Every request still passes through `TenantIdMiddleware`'s existing `X-Tenant-Id` presence check (an already-established platform quirk for platform-scoped resources — `TenantEndpoints.cs` behaves identically today, with the same documented "intentionally unauthenticated, trusted-network-only until real auth" caveat carried over verbatim).

## 2. API

**`DirectoryApi`**
| Method | Path | Notes |
|---|---|---|
| POST / GET | `/banners` | create, paginated list |
| GET / PUT / DELETE | `/banners/{id}` | hard delete — matches `Holiday`'s precedent for simple content-management entities with no cascading concerns |
| POST / GET | `/posters` | create, paginated list, filterable by `isActive`/`position` |
| GET / PUT / DELETE | `/posters/{id}` | hard delete |
| POST / GET | `/app-versions` | create, paginated list, filterable by `targetApp`/`releaseStatus` |
| GET / PUT | `/app-versions/{id}` | no `DELETE` — release records are a history, corrected via `PUT` (e.g. fixing a `Draft` before it's `Published`) or superseded via `ReleaseStatus`, not removed |

## 3. Error Handling & Testing

RFC 7807 throughout. `DataAnnotationsValidator`, `PagedResult<T>` — standard platform conventions. Per the standing 2026-08-19 test-deferral policy, no new `[Fact]` tests in this plan.
