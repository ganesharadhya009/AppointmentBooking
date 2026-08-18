# Phase 6: Staff App Backend — Design

**Status:** Approved for planning
**Date:** 2026-08-18
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` §2 (roadmap). Grounded in `Requirments/BimBa-Pro-Functional-Requirements dashboard and mobile.html` §18 (Mobile App — Doctor & Admin).

## 1. Scope — Deliberately Small

Per the reference material's own framing, the Doctor & Admin app is "a native mirror" of existing admin console capabilities: today's appointment KPIs, book-slots (already `POST /appointments`), transactions, support. It is a different client of the same backend, not a new backend domain — unlike Phase 5, there's no new authorization model needed either, since this app is staff-facing and uses the same trust boundary the Admin SPA already does.

**The only plausibly new backend surface: a "today" KPI aggregation endpoint** — today's upcoming appointments, today's cancelled, doctors/therapists on leave today, today's completed. This is a read-shaped query over data `SchedulingApi` (appointments) and `DirectoryApi` (leave requests, once Phase 2 builds them) already own.

## 2. Service Placement

`GET /appointments/today-summary` (exact route TBD) on `SchedulingApi`, joining in leave data from `DirectoryApi` via the existing cross-service client pattern — no new service, no new persisted entity.

## 3. Data Model Summary

None. This phase adds a query shape, not a schema.

## 4. Deviations from BimBa-Pro

None of substance — this phase inherits whatever decisions Phase 1-4 already made for the underlying data.

## 5. Open Questions

None load-bearing. The main judgment call at implementation-planning time is simply whether the KPI aggregation is worth its own endpoint now or can wait until an actual mobile client exists to consume it — low-risk either way, unlike Phase 5's genuine blocker.
