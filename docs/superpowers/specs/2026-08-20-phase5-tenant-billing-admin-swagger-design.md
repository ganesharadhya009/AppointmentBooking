# Phase 5 Parent-App Filters, Tenant Billing, Admin User Directory & Swagger — Design

**Status:** Approved for planning
**Date:** 2026-08-20
**Parent specs:** `docs/superpowers/specs/2026-08-18-phase5-parent-app-backend-design.md`, `docs/superpowers/specs/2026-08-18-phase4-platform-marketing-design.md` §2 (Admin User Management, Tenant billing/onboarding — both left open at the time).

**Review mode:** single sonnet-tier reviewer per task, no separate final whole-branch review — per the 2026-08-20 cost checkpoint. All of this is CRUD/filter work or tooling config, no money movement, no new risk surface.

**User decision (2026-08-20):** proceed with all of this now, resolving each open question below rather than deferring further.

## 1. Phase 5 — resolved: build on the existing stub trust model

Phase 5's own spec §4 already lays out three options and doesn't pick one. **Resolution: option 1** — build the API surface with the same `X-Tenant-Id` header-stub trust model every other endpoint on this platform already uses, explicitly accepting that it is not safe to expose to the general public until real auth exists (deferred to the project's last phase, per the standing 2026-08-17 decision). This is not new risk, it's the same already-accepted risk extended one level deeper — anyone trusted with a tenant's `X-Tenant-Id` today can already act as any therapist/branch/parent within that tenant on every write endpoint that takes an id parameter (e.g. `POST /wallets/{parentId}/credit` doesn't verify the caller *is* that parent either). Documented explicitly in `DEFERRED-AND-TODO.md` as an escalation of the existing tracked item, matching how `BillingApi`'s money-movement work escalated it once already.

**Per Phase 5's own §2 framing** ("not a new domain, exposing existing capabilities to a new consumer"), the actual gap is narrow: a parent-facing client needs to filter requests down to its own family, since today's list endpoints return every family's data platform-wide (correct for a staff view, wrong for a parent view). Everything else a parent needs already works as-is with no changes: `POST /appointments`, `POST /doctor-appointments` (booking), `GET/POST /wallets/{parentId}` + `POST /payment-checkouts` (wallet), all already unrestricted by caller identity (same stub trust model, nothing to add).

**Concrete additions:**
- `ClientRecordsApi`: `parentId` filter on `GET /children` — "list my children."
- `SchedulingApi`: `childId` filter on `GET /appointments` and `GET /doctor-appointments` — "my child's appointments." A `childId`-scoped filter (not a `parentId`-scoped one requiring a cross-service resolution) — a parent client calls `GET /children?parentId=X` once, then filters appointments per child id it gets back. Simpler, no new cross-service coupling, consistent with keeping `SchedulingApi` from growing parent-resolution logic it doesn't otherwise need.

**Explicitly not built:** `NotificationPreference`/`DeviceToken` (Phase 5 spec §3 itself calls this "genuinely minor, deferred to implementation planning" — no notification-delivery system exists anywhere on this platform to attach it to; building the preference row with nothing to act on it is premature).

## 2. Tenant Billing/Onboarding — resolved: internal-tooling-only, not public self-serve

**Resolution:** sales-assisted / ops-provisioned onboarding, not public self-serve — on structural security grounds, not a business-taste call. A public, unauthenticated signup form that creates billing-relevant subscription records is a direct spam/abuse vector; that's exactly the class of exposure the standing "defer all real auth" decision already rules out for every other public-facing surface on this platform. `TenantSubscription` extends the already-existing `Tenant` entity, provisioned through the same trusted-network-only surface `TenantEndpoints.cs` already uses (see its own `SECURITY` comment) — not a new, wider-open one. A real public self-serve flow becomes buildable once real auth exists; that door isn't closed, just not opened now.

**`TenantSubscription`** (`DirectoryApi`)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid (FK, unique — one active subscription per tenant) | |
| PlanName | string, required | free-form for now (`"Starter"`, `"Growth"`, etc.) — a real plan catalog is a future refinement once pricing is decided, not blocking this record's existence |
| Status | enum: Active / PastDue / Cancelled | |
| BillingCycle | enum: Monthly / Annual | |
| NextBillingDate | DateOnly | |
| CreatedAt | DateTimeOffset | |

## 3. Admin User Directory — resolved: credential-free stub, per the parent spec's own suggestion

Per `docs/superpowers/specs/2026-08-18-phase4-platform-marketing-design.md` §2: "A staff-directory stub (name/contact/role fields, no real password/credential handling) could be built now if useful, with real auth wired in later." Building it now — a directory of who works at a tenant and what role they hold, zero credential/login capability, same trust model as everything else.

**`StaffMember`** (`DirectoryApi`, tenant-scoped)
| Field | Type | Notes |
|---|---|---|
| Id | Guid (PK) | |
| TenantId | Guid | |
| Name | string, required | |
| Email | string, required | **not** a login identifier — no password, no credential of any kind exists on this entity |
| Phone | string? | |
| Role | enum: Admin / FrontDesk / Therapist / DoctorCoordinator | roles as *labels*, not as an authorization mechanism — nothing on the platform checks this field to gate anything, since there's no real identity system to attach it to yet |
| IsActive | bool | |
| CreatedAt | DateTimeOffset | |

## 4. Swagger/OpenAPI for manual API testing

Add `Microsoft.AspNetCore.OpenApi` (built into .NET 9 Minimal APIs) + Swashbuckle's `Swashbuckle.AspNetCore` for the interactive Swagger UI, to all four .NET services (`DirectoryApi`, `SchedulingApi`, `ClientRecordsApi`, `BillingApi`) — Development-environment-only (`app.Environment.IsDevelopment()`), matching the platform's existing "never expose internal tooling beyond trusted context" posture. `X-Tenant-Id` (and, for `BillingApi`'s payment callback, `X-Gateway-Webhook-Secret`) documented as required headers via Swashbuckle's operation filters so the UI actually lets someone exercise a real request end-to-end, not just read the shape.

## 5. Error Handling & Testing

RFC 7807 unaffected — these are additive filters/new simple entities/tooling config, no new validation surface beyond standard `[Required]`/nullable-value-type DTOs. Per the standing 2026-08-19 test-deferral policy, no new tests in this plan.
