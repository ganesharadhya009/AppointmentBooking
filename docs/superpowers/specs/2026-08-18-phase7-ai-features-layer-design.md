# Phase 7: AI Features Layer — Design

**Status:** Approved as a pattern, not a fixed build list
**Date:** 2026-08-18
**Parent spec:** `docs/superpowers/specs/2026-08-15-phase1-foundation-core-ops-design.md` §2 (roadmap: "Cuts across phases — smart scheduling, no-show prediction, note summarization, enquiry triage — Per phase augmented"), §7 (Phase 1 AI Stub, already built).

## 1. This Is Not a Phase Like the Others

Every other phase adds a bounded set of new modules. Phase 7 is a cross-cutting pattern: `ai-service` gains new capabilities incrementally as each *other* phase's data becomes available to reason over. There is no fixed Phase 7 scope to design today — enquiry-triage AI needs Phase 2's `Enquiry` data to exist first; no-show prediction needs Phase 3's cancellation/completion history to accumulate; note summarization needs clinical note data that doesn't exist in any phase's current design.

## 2. What's Already Built (Phase 1)

`GET /suggestions` on `ai-service` — rule-based slot ranking, advisory-only, reading `DirectoryApi`+`SchedulingApi` live data. This established the pattern every future AI feature should follow:

- **Advisory-only, never in the write path** — an AI feature suggests, a human/staff action books. This invariant (from the Phase 1 spec §7) applies to every future capability added here, not just the slot-suggestion stub.
- **Opaque identifiers only, no PII crossing into `ai-service`** — the same data-handling policy applies to whatever new data source a future AI feature reads from.
- **Rule-based first, model-based only when the rule-based version's limits are actually hit** — the slot-suggestion stub deliberately skipped pgvector/ML for exactly this reason; the same YAGNI applies to every future feature here.
- **Downstream failure isolation** — a future AI feature failing must never break the underlying operation it's advising on, same as the slot-suggestion stub excluding a therapist rather than failing the whole request.

## 3. How Future AI Features Get Scoped

Each new AI capability gets its own brainstorm → spec → plan cycle **once its prerequisite phase's data exists** — not designed speculatively now against data that doesn't exist yet. Candidate features, in rough dependency order:

- **Enquiry triage** (needs Phase 2's `Enquiry`) — rank/prioritize incoming enquiries for follow-up.
- **No-show / cancellation prediction** (needs Phase 3's reporting data with real history accumulated) — flag appointments at elevated cancellation risk.
- **Smart scheduling** (an evolution of the existing slot-suggestion stub, likely once real usage data exists to move past pure rule-based ranking) — this is the one capability that's a direct extension of already-built work rather than a new module.
- **Note summarization** — needs a clinical-notes data source that doesn't exist in any phase's current design; out of scope until something creates that data.

## 4. Deviations from BimBa-Pro

None — BimBa has no AI features at all; this entire phase is new to this product by design (Phase 1 spec §8).

## 5. Open Questions

None to resolve now. The open question structurally *is* "which phase are we augmenting" — answered freshly each time a capability is actually proposed, not batched into one speculative design here.
