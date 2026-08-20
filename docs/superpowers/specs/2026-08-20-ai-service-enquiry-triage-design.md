# AI Service Enquiry Triage — Design

**Status:** Approved for planning
**Date:** 2026-08-20
**Parent spec:** `docs/superpowers/specs/2026-08-18-phase7-ai-features-layer-design.md` §3 — the one Phase 7 candidate whose prerequisite data (Phase 2's `Enquiry`) already exists. The other three candidates (no-show prediction, smart-scheduling evolution, note summarization) still need data this platform doesn't have yet (accumulated history, or a clinical-notes source), so they stay unscoped per that spec's own framing.

**Review mode:** single sonnet-tier reviewer, no separate final whole-branch review — per the 2026-08-20 cost checkpoint. Read-only, rule-based, no new entity, no write path.

## 1. Scope

`GET /enquiry-triage` on `ai-service` — ranks a tenant's `Submitted` enquiries by follow-up priority, so staff know who to call first. Same invariants as the existing slot-suggestion stub (Phase 1 spec §7, restated in the Phase 7 spec §2): advisory-only (never books/converts anything), opaque identifiers only, rule-based first.

**Deliberately not built:** persistence/audit-logging of triage results (unlike `GET /suggestions`'s `SlotSuggestionLog` table). `ai-service` has no Alembic migration tooling yet (`SlotSuggestionLog` itself has no real migration path — an already-tracked `DEFERRED-AND-TODO.md` gap). Adding a second unmigrated SQLAlchemy model would compound that gap rather than avoid it. This endpoint stays purely computational/stateless until the migration tooling gap is closed.

## 2. Ranking Rule (rule-based, per the platform's established AI policy)

Pure function, same shape as `ranking.py`'s `rank_candidates`. Score components, summed:

- **Days waiting** (`today - CreatedAt`, capped at 30) — an enquiry sitting longer without follow-up is more overdue, not less.
- **Overdue follow-up** (`FollowUpDate` set and in the past): `+50` — the single strongest signal; a promised callback that didn't happen.
- **Follow-up due today**: `+20`.
- **Has a diagnosis report attached** (`DiagnosisReportUrl` set): `+10` — a more "ready" lead, closer to conversion.
- **Concern count** (`len(Concerns) * 2`) — more documented concerns is a weak-but-real urgency signal.

Each item's response includes a human-readable `reasons` list (e.g. `"Follow-up overdue by 3 days"`, `"Waiting 12 days"`) — a bare score number isn't actionable for a staff member deciding who to call; the reasons are.

## 3. Cross-Service Client

New `ClientRecordsApiClient` in `app/clients/client_records_client.py`, following `DirectoryApiClient`'s exact pattern (`get_active_therapists`'s paged-fetch shape): `GET /enquiries?status=Submitted&pageSize=100` on `ClientRecordsApi`, `X-Tenant-Id` header, `httpx.AsyncClient(timeout=5.0)`, empty list on any `HTTPError` or non-200 (fail-open — a `ClientRecordsApi` outage degrades the triage list to empty, never crashes the caller). `pageSize=100` is a known limitation carried over verbatim from `get_active_therapists`'s own identical cap — a tenant with more than 100 simultaneously `Submitted` enquiries isn't handled by this pass; tracked in `DEFERRED-AND-TODO.md` alongside the pre-existing `?ids=`/batch-lookup gap this session has flagged twice already.

## 4. Response Shape

```python
class EnquiryTriageItem(CamelModel):
    enquiry_id: UUID
    parent_name: str
    child_name: str
    priority_score: float
    reasons: list[str]
    days_waiting: int
    follow_up_date: datetime | None

class EnquiryTriageResponse(CamelModel):
    items: list[EnquiryTriageItem]
    generated_at: datetime
```

Sorted by `priority_score` descending.

## 5. Error Handling & Testing

Per the standing 2026-08-19 test-deferral policy, no new tests in this plan (this is the first Python sub-project built under that policy — the same rule applies regardless of language).
