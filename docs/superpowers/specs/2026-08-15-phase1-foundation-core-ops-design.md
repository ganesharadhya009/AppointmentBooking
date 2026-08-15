# Phase 1: Foundation & Core Ops — Design

**Status:** Approved for planning
**Date:** 2026-08-15
**Reference material:** `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` — a reverse-engineered functional spec of an existing product (BimBa-Pro / CDC Connect), used here as a feature-parity baseline, not as a source of new requirements.

## 1. Product Vision

Build a multi-tenant SaaS platform for child-development-therapy clinic networks — multi-branch operators offering occupational therapy, speech & language therapy, ABA, physiotherapy, and related services. The platform lets a clinic network manage branches, therapists, service catalogs, client/child records, and appointment scheduling, with room to layer in AI features and to later resell individual capabilities (starting with appointment scheduling) as standalone B2B APIs to other businesses.

BimBa-Pro is used as the feature-parity baseline: the new product should do everything it does, done to a higher, more "professional" standard, plus AI features it lacks. It is not a 1:1 clone — see §8 for deliberate deviations.

## 2. Roadmap (all phases)

| Phase | Scope | Depends on |
|---|---|---|
| **1. Foundation & Core Ops** *(this document)* | Multi-tenant infra, auth/roles, branches, therapy catalog, therapist scheduling, client & child records, core appointment booking engine (staff-booked only) | — |
| 2. Front-of-house extensions | Consultants track, enquiries/lead pipeline, holidays, activity desk (approvals, tickets) | Phase 1 |
| 3. Reporting & Financials | Operational/appointment/cancellation reports, wallet, payment gateway, transactions | Phase 1–2 |
| 4. Platform & Marketing tools | Banners/posters, app version mgmt, admin user mgmt, tenant billing/onboarding | Phase 1 |
| 5. Parent mobile/web app | Client self-booking, wallet, support | Phase 1, 3 |
| 6. Staff mobile app | Therapist/admin on-the-go app | Phase 1–3 |
| 7. AI features layer | Cuts across phases — smart scheduling, no-show prediction, note summarization, enquiry triage | Per phase augmented |

Only Phase 1 is designed in detail here.

## 3. Phase 1 Scope

In scope, mapped to the BimBa-Pro modules they correspond to (§ numbers refer to the reference spec):

- **Authentication & tenancy** (ref §01, §16) — multi-tenant login, role-based access
- **Branches** (ref §04) — branch CRUD, geolocation, package discount tiers
- **Therapy Catalog** (ref §05) — service catalog per branch, soft delete
- **Therapist Management** (ref §06) — therapist onboarding, per-branch/session-window schedule and pricing
- **Client & Child Records** (ref §13) — parent and child profiles, bulk import
- **Core Appointment Booking Engine** (ref §01/§03 booking flow only) — staff-initiated booking, no self-service channel yet

Out of scope for Phase 1 (deferred to later phases, see §2): consultants, enquiries, holidays, activity-desk approvals/tickets, all reporting, wallet/payments, banners/posters, app-version management, admin user management UI, both mobile apps, and all AI features beyond a single stub endpoint (§7).

### Roles (Phase 1)

Carried forward from the reference spec's observed roles: **Super Admin**, **Admin**, **Therapist**, **Auditor**. (HR is deferred — no HR-specific functionality exists yet in this scope.) Role is a claim on the auth token, scoped per tenant; a user's role does not carry across tenants.

## 4. Architecture

Modular services — not a full microservices sprawl. The rule of thumb: split a domain into its own service only if it might be sold or isolated independently, or if it holds materially more sensitive data than its neighbors. Everything else stays inside a shared service to keep operational overhead low for a small team.

```
                        ┌─────────────────────────┐
                        │   React (TS) Admin SPA   │
                        └────────────┬─────────────┘
                                     │
                        ┌────────────▼─────────────┐
                        │  Azure API Management     │  ← also the future
                        │  (gateway: auth, rate      │    B2B entry point
                        │   limiting, routing)       │
                        └───┬───────┬───────┬───────┘
                            │       │       │
              ┌─────────────┘       │       └─────────────┐
              │                     │                      │
     ┌────────▼────────┐  ┌────────▼─────────┐   ┌─────────▼────────┐
     │  Directory API    │  │  Scheduling API   │   │ Client Records API│
     │  .NET / Azure SQL │  │  .NET / Azure SQL │   │ .NET / Azure SQL   │
     │  Branches,         │  │  (own DB)          │   │  (own DB)          │
     │  Therapy Catalog,  │  │  Appointments,     │   │  Parents, Children │
     │  Therapists,       │  │  booking engine,   │   │                    │
     │  Tenants           │  │  availability      │   │                    │
     └────────────────────┘  └────────┬───────────┘   └────────────────────┘
                                       │ (proposal suggestions, later)
                              ┌────────▼─────────┐
                              │   AI Service       │
                              │ Python/FastAPI     │
                              │ Postgres+pgvector   │
                              └────────────────────┘

     Identity: Auth0 (Organizations for multi-tenant login/roles,
               M2M client-credentials tokens for future B2B API consumers)
```

**Services:**

1. **Directory API** (.NET, own Azure SQL database) — Tenants, Branches, Therapy Catalog, Therapists (with per-branch schedule/pricing). This is the "who and what" of the network.
2. **Scheduling API** (.NET, own Azure SQL database) — the booking engine: appointment creation, availability computation, staff-initiated booking. Built with a versioned, stable public contract (resource-oriented REST, API-key/OAuth client-credentials auth for external callers, per-consumer rate limiting) from day one, so that turning this into a standalone B2B "Appointment Booking API" product later is an infrastructure and packaging change, not a rewrite.
3. **Client Records API** (.NET, own Azure SQL database) — Parents & Children profiles. Split out on its own because it holds the platform's most sensitive PII, warranting its own access boundary even before scale demands it.
4. **AI Service** (Python/FastAPI, own Postgres database with pgvector) — scaffolded now with a single real endpoint (proposed: smart slot-suggestion for staff booking, ranking available therapist/slot combinations) to prove the cross-service integration pattern early without committing to a large AI scope yet. The AI Service is never in the critical path of booking: the call direction is AI Service → Scheduling API (reading availability), never the reverse, and the Scheduling API's write endpoints do not accept calls from the AI Service. If the AI Service is down, slow, or unauthenticated, booking must succeed with suggestions simply omitted, not fail.

**Gateway:** Azure API Management sits in front of all services. Today it validates Auth0 tokens, routes to the right service, and applies rate limits for the admin SPA's traffic. It is the same component that will front external B2B traffic to the Scheduling API in a later phase.

**Identity:** Auth0, using **Organizations** for multi-tenant login and role assignment (Super Admin / Admin / Therapist / Auditor, scoped per tenant), and **M2M (client-credentials) tokens** for the future B2B consumers of the Scheduling API. No custom identity service is built — Auth0 is the source of truth for who a user is and which tenant/role they're acting as.

**Prerequisite before external exposure:** every M2M credential issued to a future B2B consumer must be minted per-tenant, carrying a single non-overridable `TenantId` claim that the gateway and Scheduling API validate identically to a user token's tenant claim. This is not required for Phase 1 — no external consumer exists yet — but must be in place before the Scheduling API is opened to any external consumer in a later phase (tracked in §12).

**Frontend:** React + TypeScript SPA (Vite), calling everything through the gateway. No server-side rendering needed for an authenticated admin console.

## 5. Tenancy Model

Each core service (Directory, Scheduling, Client Records) uses a **single shared Azure SQL database with a `TenantId` column on every table**, enforced through EF Core global query filters that read the tenant claim out of the validated Auth0 token — never a client-supplied tenant identifier.

This is chosen over database-per-tenant because, for a small team, operating N databases is a heavier ongoing burden than it's worth at this stage. Because the data-access layer already filters everything by `TenantId`, moving a specific large customer to an isolated database later (e.g. for a contractual isolation requirement) is a migration, not an architectural rewrite.

**This is a cross-service requirement, not an EF-specific one.** The AI Service's Postgres store also carries a `TenantId` column on every table and must filter every query by the tenant claim from the validated token in its own code (e.g. a FastAPI dependency that performs the equivalent of EF's global query filter). The enforcement mechanism differs per stack, but no service — .NET or Python — is exempt from enforcing it in code; tenancy is never assumed safe by convention alone.

## 6. Data Model (Phase 1)

Field-level schema belongs in the implementation plan; this is the entity summary that grounds service boundaries.

**Directory API**
- `Tenant` — the clinic network account itself (name, subscription status)
- `Branch` — name, address/geolocation, weekly day-off, photo, 5-tier package discount schedule (session counts 10/24/48/72/96, each with its own per-session discount amount)
- `TherapyType` — name, owning branch(es), photo, active/soft-deleted status; one therapy name can be attached to multiple branches
- `Therapist` — identity/credentials (name, contact, license number, designation, photo/certificate), one or more branch assignments, each assignment carrying its own therapy service, joining date, day-off, lunch break, and up to four priced session windows (Morning/Noon/Afternoon/Evening)

**Client Records API**
- `Parent` — contact, address, linked children
- `Child` — name, DOB, gender, guardian link

**Scheduling API**
- `Appointment` — child, branch, therapist, therapy, date/time slot, status (Planned/Completed/Cancelled), staff who booked it
- `AvailabilitySlot` — computed from therapist session windows, existing bookings, and branch day-off (holiday-awareness itself is a Phase 2 input; Phase 1 availability only accounts for therapist schedule + existing bookings)

**AI Service**
- No persistent domain data of its own in Phase 1 beyond what the stub endpoint needs (e.g. a `SlotSuggestionLog` for observability); expands per-phase as real AI features are added.

## 7. AI Stub (Phase 1)

One real endpoint: given a child, therapy type, and branch, the AI service returns a ranked list of suggested therapist/slot combinations (calling the Scheduling API's availability data). This is deliberately small — the goal is proving the pattern (service-to-service auth, deployment, gateway routing to a Python service) before Phase 7 builds out the full AI feature set.

**Advisory-only invariant.** The AI Service's output is a suggestion, never an action: a booking is only ever created by an authenticated staff member's explicit action against the Scheduling API. The Scheduling API's write endpoints do not accept calls from the AI Service, and no future change may wire a ranked suggestion directly into a booking without this section being explicitly revised and re-approved — this boundary is not allowed to erode silently as the AI feature set grows in Phase 7.

**Data handling.** Only opaque identifiers and slot metadata (child ID, branch ID, therapy-type ID, timing) are sent to the AI Service — names, DOB, guardian contact details, and any free-text clinical/diagnosis fields never cross into it. `SlotSuggestionLog` entries are retained for 90 days and then purged; this window may be revisited during implementation planning but the default is fixed here rather than left open, since this is child health-adjacent data.

## 8. Deliberate deviations from BimBa-Pro

- **Multi-tenant from the start** — BimBa-Pro is a single-operator internal tool; this product is sellable to many clinic networks.
- **Staff-only booking in Phase 1** — BimBa-Pro's Activity Desk manual-booking flow is replicated, but the self-service parent channel is deferred to Phase 5 rather than built in parallel now.
- **Scheduling designed for external resale** — BimBa-Pro has no concept of external API consumers; this product's Scheduling API is contract-first for that reason from day one.
- **AI features** — BimBa-Pro has none; this product adds an AI layer progressively (Phase 7), starting with a Phase 1 stub.

## 9. Error Handling

Every .NET service returns **RFC 7807 Problem Details** on failure, produced by centralized exception-handling middleware (no per-endpoint try/catch for error formatting). A correlation ID is issued at the API Management gateway and propagated through all downstream service calls, so a single request can be traced across Directory/Scheduling/Client Records/AI in Application Insights.

Scheduling API write endpoints (starting with `POST /appointments`) require an idempotency key from the caller: a retried request carrying the same key returns the original result instead of creating a duplicate booking. This applies regardless of whether the retry comes from a flaky client, a gateway timeout, or a future automated caller — duplicate bookings from naive retries are treated as a correctness bug, not an acceptable edge case.

## 10. Testing Strategy

- **xUnit** unit tests per service for domain logic (slot-conflict rules, discount-tier calculation, tenant-scoping filters)
- **Integration tests** against a real SQL instance (containerized) for EF Core / repository behavior
- **Contract tests** specifically on the Scheduling API's public endpoints — its contract needs to stay stable once external B2B consumers exist, so this is verified from Phase 1 onward, before any external consumer exists
- **React:** component tests (Vitest + React Testing Library) and Playwright end-to-end tests for the critical admin flows: login, create branch, create therapist, book an appointment, add a client/child

## 11. Hosting & Operations

- **Compute:** Azure Container Apps for the .NET services and the Python AI service (per-service scaling, lower operational overhead than AKS at this team size)
- **Frontend hosting:** Azure Static Web Apps for the React SPA
- **Secrets:** Azure Key Vault
- **Observability:** Application Insights across all services, correlated by the gateway-issued correlation ID
- **CI/CD:** GitHub Actions, one pipeline per service, independent deploys

## 12. Open Questions / Assumptions Carried Forward

These mirror gaps the reference spec itself flagged (its Appendix C) and remain open for this product too:

- Exact server-side validation rules and rate limits are not yet defined — to be specified during implementation planning, not assumed from BimBa-Pro's client-side field markers.
- Row-level mutation flows (approve/reject, edit-in-place) for Phase 2+ modules are not designed yet — out of scope for Phase 1.
- The AI stub's exact ranking heuristic (rule-based vs. model-based) is an implementation-planning decision, not fixed here.
- **M2M client-credentials token scoping** (one credential bound to exactly one `TenantId`, non-overridable — see §4) must be finalized before the Scheduling API is opened to any external B2B consumer. Not required for Phase 1 since no external consumer exists yet; tracked here specifically so it isn't skipped when that phase starts.
