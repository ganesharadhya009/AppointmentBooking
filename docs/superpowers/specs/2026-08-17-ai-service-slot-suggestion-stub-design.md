# AI Service — Slot Suggestion Stub — Design

**Status:** Approved for planning
**Date:** 2026-08-17
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` §7 (AI Stub), §4 (architecture), §5 (tenancy). This is the last piece of Phase 1's backend scope, and the first real feature on `ai-service` — currently a Python/FastAPI `/health`-only skeleton from Platform Foundation.

## 1. Scope

One real endpoint: `GET /suggestions` on `ai-service`, returning a ranked list of therapist/session-window combinations for a given child, branch, therapy type, and date, by combining live data from `DirectoryApi` (candidate therapists + pricing) and `SchedulingApi` (real-time availability). Advisory-only: the AI Service never creates, modifies, or is capable of creating a booking — it is a pure read-and-rank layer sitting alongside the booking flow, not in it.

**Out of scope:** model-based/ML ranking (deferred to Phase 7, per parent spec §12 — this stub is deliberately rule-based to prove the cross-service/cross-language integration pattern first), pgvector (no vector search needed by a rule-based ranker — installing the extension now with no consumer is premature), any endpoint that mutates `SchedulingApi`/`DirectoryApi` state, real Auth0/tenant auth (deferred to the last phase of the whole project per explicit 2026-08-17 roadmap decision — this service uses the same `X-Tenant-Id` trust model as every other service).

## 2. Roadmap Context

Per the 2026-08-17 roadmap-reordering decision: this is the final backend (DB/API) item remaining in Phase 1's scope (§3 of the parent spec — Branches, Therapy Catalog, Therapist Management, Client & Child Records, and Core Appointment Booking Engine are already done; only Authentication & tenancy remains, and that is explicitly deferred to the project's last phase). Completing this closes out Phase 1's backend build-out; Admin SPA screens and Phase 2+ backend work follow.

## 3. Data Flow

```
Admin SPA (staff) ──GET /suggestions?childId=&branchId=&therapyTypeId=&date=──▶ AI Service
                                                                                     │
                              ┌──────────────────────────────────────────────────────┤
                              │                                                      │
                    GET /therapists?branchId=&therapyTypeId=&status=Active   (per candidate)
                    ──────────────────────────────────▶ DirectoryApi        GET /availability?branchId=&therapistId=&therapyTypeId=&date=
                                                                              ──────────────────────────────────▶ SchedulingApi
```

1. AI Service receives the request, forwarding the caller's `X-Tenant-Id` header to both downstream calls (same trust model as `SchedulingApi`'s existing `IDirectoryApiClient`/`IClientRecordsApiClient` pattern — no new auth mechanism).
2. Calls `DirectoryApi`'s `GET /therapists?branchId=&therapyTypeId=&status=Active` (a new filter added to the existing endpoint — see §7) to get the list of candidate therapists, each already carrying their session-window pricing.
3. For each candidate therapist, calls `SchedulingApi`'s existing `GET /availability?branchId=&therapistId=&therapyTypeId=&date=` to get that therapist's open windows for the requested date.
4. Combines availability (from Scheduling) with pricing (from Directory) per therapist/window pair, ranks the combined list, and returns it.
5. Logs the request + ranked result to `SlotSuggestionLog` (Postgres) for observability, retained 90 days.

**Failure isolation:** if a specific therapist's `SchedulingApi` call fails (timeout, 5xx, unreachable), that therapist is excluded from the ranked result — not a hard error for the whole request. If `DirectoryApi` itself is unreachable (no candidates obtainable at all), the endpoint returns an empty `suggestions` array, not a 500. This mirrors the parent spec's "if the AI Service is down, booking must succeed with suggestions omitted" philosophy, applied one level down to the AI Service's own dependency failures.

## 4. Ranking Heuristic

Rule-based, not model-based, per parent spec §12's explicit framing of this as an implementation decision and the stub's goal of proving the integration pattern rather than building real AI now (Phase 7's concern).

**Rule:** sort candidates by earliest session-window start time ascending, tie-broken by lowest `pricePerSession` ascending. A `score` field is included in the response (lower = better-ranked) so a future model-based ranker can slot in behind the same response contract without a breaking change — for this stub, `score` is simply the sort key encoded as a number (e.g. minutes-since-midnight of `startTime`, with price as a sub-cent tiebreak fraction), not a probabilistic confidence value.

## 5. Data Model

**`SlotSuggestionLog`** (Postgres, tenant-scoped, one row per request — not per suggestion)

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| tenant_id | UUID | no EF-style global query filter available in Python — every query includes an explicit `WHERE tenant_id = :tenant_id`, applied via a FastAPI dependency (see §6) |
| child_id | UUID | opaque identifier only — no name/DOB ever stored or requested |
| branch_id | UUID | |
| therapy_type_id | UUID | |
| requested_date | date | |
| suggestions | JSONB | the full ranked array as returned to the caller, for observability |
| created_at | timestamptz | |

One row per request (not normalized per-suggestion) keeps the 90-day purge trivial (`DELETE FROM slot_suggestion_logs WHERE created_at < now() - interval '90 days'`) since the log is written for observability, never queried structurally by anything else. The purge itself is out of scope for this stub's endpoint work — implemented as a scheduled job/startup check in the implementation plan, matching the parent spec's fixed 90-day default (§7).

**No pgvector.** The architecture doc (parent spec §4) lists `ai-service`'s database as "Postgres+pgvector," but a rule-based ranker has no vector-search need. Deferred to Phase 7 when a real model-based ranker exists to consume it — a bare Postgres table is all this stub needs, and installing an unused extension now adds environment/ops complexity with no current benefit.

## 6. Tenant Isolation (Python)

A FastAPI dependency (`get_tenant_id`) reads and validates `X-Tenant-Id` from the request header exactly like `.NET`'s `TenantIdMiddleware`/`TenantContext` pair, but implemented as dependency injection rather than ASP.NET middleware (Python/FastAPI's idiomatic equivalent). Every `SlotSuggestionLog` query explicitly filters by the resolved `tenant_id` — there is no global-query-filter equivalent in SQLAlchemy, so this must be applied by hand at every query site, consistent with parent spec §5's explicit callout that "no service — .NET or Python — is exempt from enforcing it in code."

## 7. API

| Method | Path | Notes |
|---|---|---|
| GET | `/suggestions?childId=&branchId=&therapyTypeId=&date=` | returns `{ suggestions: [{ therapistId, windowName, startTime, endTime, pricePerSession, score }], generatedAt }` |

**Directory API change (small, in-scope addition):** `GET /therapists` gains `branchId`, `therapyTypeId`, and `status` query filters (currently pagination-only). This is the mechanism the AI Service needs to discover candidates without fetching every therapist in the tenant and filtering client-side — it also closes a filter gap already flagged in `DEFERRED-AND-TODO.md` ("No batch/filtered lookup endpoints").

## 8. Error Handling

FastAPI's standard `{detail: "..."}` error shape via `HTTPException` — not RFC 7807. RFC 7807 is an established convention for this platform's .NET services; there's no cross-language requirement to replicate it exactly in a Python service, and FastAPI's idiomatic error shape is well-understood tooling-wise (OpenAPI docs, client generators).

## 9. Testing

- Unit tests for the ranking function (pure, no I/O): given a list of therapist/window/price combinations, assert the correct sort order including the earliest-time-wins and price-tiebreak rules.
- Integration tests with `DirectoryApi`/`SchedulingApi` calls faked via HTTP mocking (e.g. `respx`), mirroring the established `IDirectoryApiClient`/`IClientRecordsApiClient` fakeable-client pattern from `SchedulingApi` — `ai-service`'s own test suite never needs `DirectoryApi`/`SchedulingApi` actually running.
- `SlotSuggestionLog` persistence tests against **SQLite in-memory**, not real Postgres — the schema has no Postgres-specific column types (no pgvector, no JSONB-specific query operators used), so SQLite's JSON support is sufficient for testing while production still targets real Postgres per the architecture doc. This avoids requiring a local Postgres instance for the test suite.
- A test for the failure-isolation behavior (§3): one candidate therapist's `SchedulingApi` call failing does not fail the whole request; `DirectoryApi` being entirely unreachable returns an empty `suggestions` array, not a 500.
- Directory API: a test for the new `branchId`/`therapyTypeId`/`status` filter combination on `GET /therapists`, including that omitting all three still returns the existing unfiltered paginated behavior (backward compatible).
