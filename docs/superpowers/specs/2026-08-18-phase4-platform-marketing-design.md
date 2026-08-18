# Phase 4: Platform & Marketing Tools — Design

**Status:** Approved for planning
**Date:** 2026-08-18
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` §2 (roadmap). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §14 (Banners & Posters), §15 (App Version Management), §16 (Admin User Management).

## 1. Scope

- **Banners & Posters** (ref §14) — app-wide banner/watermark, company invoicing profile, scheduled promotional posters.
- **App Version Management** (ref §15) — forced-update release records for the companion mobile apps.
- **Admin User Management** (ref §16) — back-office staff account provisioning.
- **Tenant billing/onboarding** — new, since BimBa is a single-operator tool with no multi-tenant concept; this platform needs a real SaaS subscription/onboarding flow that BimBa has no equivalent of.

## 2. Service Placement

- **Banners/Posters/AppVersion → `DirectoryApi`.** Low-complexity, low-sensitivity, content-management concerns. Extending the existing "who and what" service avoids unnecessary microservice sprawl for domains this small (per the architecture rule of thumb).
- **Admin User Management is auth-adjacent and mostly blocked.** Provisioning back-office staff accounts inherently means credential/role management — the real version of this can't be built correctly until real Auth0 work lands, which the user has explicitly deferred to the project's last phase. A staff-directory stub (name/contact/role fields, no real password/credential handling) could be built now if useful, with real auth wired in later — this is a call for whoever plans this sub-project, not pre-decided here.
- **Tenant billing/onboarding → extends the existing `Tenant` entity already in `DirectoryApi`** (created in Phase 1's Tenant/Branch/TherapyType sub-project) rather than a new service — a `TenantSubscription` sits naturally next to the `Tenant` it describes.

## 3. Data Model Summary

**`DirectoryApi`**
- `Banner` — TenantId, ImageUrl, WatermarkTitle
- `Poster` — TenantId, Type, Position (Top/Bottom/Popup), ActiveFrom, ActiveTo, Priority, IsActive
- `AppVersion` — **platform-scoped, not tenant-scoped** (see §4) — TargetApp, VersionNumber, ReleaseStatus, RequireUpdate, ReleaseDate
- `TenantSubscription` — TenantId, PlanId, Status, BillingCycle, NextBillingDate

## 4. Deviations from BimBa-Pro

- **`AppVersion` is platform-scoped, not per-tenant.** BimBa's single-tenant framing makes app version a simple global record; in a real multi-tenant SaaS, one Admin SPA / one set of mobile app binaries serves every tenant, so a version record duplicated per tenant would be meaningless (and inconsistent — a forced-update flag can't differ by tenant when it's the same binary). This is a genuine, necessary correction from the reference material's model, not a stylistic choice.
- **Tenant billing/onboarding is entirely new** — BimBa has nothing resembling this since it's not sold as a SaaS product to multiple operators. Subscription plan structure, billing provider integration, and the actual onboarding flow (self-serve signup vs. sales-assisted) are all implementation-planning decisions, not fixed here.

## 5. Open Questions

- **Should Admin User Management be built as a real-auth-independent stub now, or fully deferred to the auth phase?** Depends on how badly the platform needs staff-directory data before real login exists — resolve when this sub-project is actually planned.
- **Billing provider choice** (Stripe Billing vs. a custom subscription/invoicing implementation) — deferred to that sub-project's brainstorm.
- **Self-serve vs. sales-assisted tenant onboarding** — a business decision, not a technical one, needed before this sub-project's design.
