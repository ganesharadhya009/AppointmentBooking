# Phase 5: Parent App Backend — Design

**Status:** Approved for planning, with a load-bearing open question (§4)
**Date:** 2026-08-18
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` §2 (roadmap). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §17 (Mobile App — Parent, "BimBa Connect").

## 1. Scope

Backend API surface for parent self-service — no native app is being built in this project's current stack (React SPA is admin-only); this phase is the API layer a future parent web/mobile client would consume. Per the reference material (ref §17): browse and book therapy sessions AND doctor consultations, manage a wallet, manage bookings for multiple children under one account, receive notifications.

## 2. What This Phase Is, Architecturally

Not a new domain — it's **exposing existing capabilities to a new, differently-authorized consumer.** Every capability a parent needs already exists somewhere: booking (`SchedulingApi`, currently staff-initiated only per Phase 1's explicit scope), child management (`ClientRecordsApi`), wallet (`BillingApi`, Phase 3), consultant booking (Phase 2, service placement TBD). This phase is primarily about **building a parent-safe authorization boundary** around those existing services, not new business logic.

## 3. Data Model Summary

No major new entities. Possibly: `NotificationPreference` or a lightweight `DeviceToken` table if push notifications need server-side tracking — genuinely minor, deferred to implementation planning.

## 4. Open Question — This Phase May Be Blocked, Not Just Under-Specified

**A parent booking for their own children requires knowing which children are theirs** — self-service booking is fundamentally an authorization problem (a parent must only see/book/pay for their own family), and this platform's tenancy stub (`X-Tenant-Id`, unauthenticated, forwarded trust) has no equivalent concept of "which parent is this." The user's 2026-08-17 decision defers all real auth to the project's last phase — but that decision was made in the context of staff-only, single-tenant-boundary trust (every backend caller today is the trusted admin SPA behind one gateway). Parent self-service is a different threat model: the caller is the general public, and "any GUID in a header" is not a survivable trust model for "let this stranger see/pay for a specific family's children."

This is flagged here rather than resolved, because it's a genuine tension between two explicit user decisions (defer all auth to the last phase; build all remaining backend work first) that this phase makes concrete. Options to weigh when this phase is actually planned:
- Build the API surface now with the same header-stub trust model, accepting that it's genuinely unsafe to expose externally until real auth exists (fine if nothing ever calls it before then).
- Decide this phase specifically needs a minimal, scoped piece of real parent authentication pulled forward, even though full Auth0 work stays deferred.
- Reorder the roadmap so Phase 5 comes after the auth phase instead of before it.

Not deciding this now — surfacing it because it's the one phase where "defer auth to the end" and "build everything else first" pull in different directions, and that's worth the user's explicit call rather than a silent assumption.

## 5. Deviations from BimBa-Pro

- BimBa's parent app was reconstructed from a public app-store listing, not a live walkthrough (the reference material's own §17 caveat) — several details (My Appointments, Support, Wallet screens) are known-incomplete in the source material. Whatever gets built here should be grounded in this platform's own already-built APIs, not assumed BimBa parity for the parts of §17 that were never actually observed.
