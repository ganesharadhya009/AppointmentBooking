# AI Service Enquiry Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /enquiry-triage` to `ai-service` — Phase 7's first (and currently only) scoped feature. Based on `docs/superpowers/specs/2026-08-20-ai-service-enquiry-triage-design.md`.

**Architecture:** One self-contained feature within `ai-service` (Python/FastAPI) — a new cross-service client, a new pure ranking function, new schemas, and a new router, following the exact conventions the existing `GET /suggestions` slot-suggestion stub already established.

**Tech Stack:** Python 3, FastAPI, httpx. No new dependencies.

## Global Constraints

- **Review mode: single sonnet-tier reviewer, no separate final whole-branch review** — per the 2026-08-20 cost checkpoint. Read-only, rule-based, no new entity.
- **Unit/integration test-writing is deferred to a later consolidated pass** (standing project policy — applies to this Python sub-project exactly as it has to every .NET one since 2026-08-19). No new test files. Acceptance: the service starts cleanly and the endpoint responds correctly when smoke-tested manually.
- Advisory-only: this endpoint must never call any write endpoint on `ClientRecordsApi` or any other service — it only reads.
- `ClientRecordsApiClient.get_submitted_enquiries` must be fail-open (`httpx.HTTPError` or non-200 → empty list, never an unhandled exception) — matching `DirectoryApiClient.get_active_therapists`'s exact shape.
- No new persisted entity, no new SQLAlchemy model, no new migration.

---

### Task 1: `GET /enquiry-triage`

**Files:**
- Create: `services/ai-service/app/clients/client_records_client.py`
- Modify: `services/ai-service/app/schemas.py`
- Create: `services/ai-service/app/triage.py`
- Create: `services/ai-service/app/enquiry_triage.py`
- Modify: `services/ai-service/app/config.py`
- Modify: `services/ai-service/app/main.py`

**Interfaces:**
- Produces: `GET /enquiry-triage`.

- [ ] **Step 1: Add the `ClientRecordsApi` base URL to config**

In `services/ai-service/app/config.py`, add this field to the `Settings` class, right after the existing `scheduling_api_base_url: str = "http://localhost:5098"` line:

```python
    client_records_api_base_url: str = "http://localhost:5084"
```

(Port confirmed from `ClientRecordsApi`'s `launchSettings.json` — the same port `SchedulingApi`'s own cross-service config already points at for this same service.)

- [ ] **Step 2: Add the new schemas**

In `services/ai-service/app/schemas.py`, add these classes at the bottom of the file:

```python
class EnquiryInfo(CamelModel):
    id: UUID
    parent_name: str
    child_name: str
    concerns: list[str] = []
    diagnosis_report_url: str | None = None
    follow_up_date: datetime | None = None
    created_at: datetime


class EnquiriesPage(CamelModel):
    items: list[EnquiryInfo]


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

- [ ] **Step 3: Create the `ClientRecordsApi` client**

`services/ai-service/app/clients/client_records_client.py`:

```python
import httpx

from app.schemas import EnquiriesPage, EnquiryInfo


class ClientRecordsApiClient:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    async def get_submitted_enquiries(self, tenant_id: str) -> list[EnquiryInfo]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(
                    f"{self._base_url}/enquiries",
                    params={"status": "Submitted", "pageSize": 100},
                    headers={"X-Tenant-Id": tenant_id},
                )
            except httpx.HTTPError:
                return []
        if response.status_code != 200:
            return []
        page = EnquiriesPage.model_validate(response.json())
        return page.items
```

- [ ] **Step 4: Create the ranking function**

`services/ai-service/app/triage.py`:

```python
from datetime import datetime, timezone

from app.schemas import EnquiryInfo, EnquiryTriageItem


def rank_enquiries(enquiries: list[EnquiryInfo]) -> list[EnquiryTriageItem]:
    """Pure function: score each Submitted enquiry by follow-up priority and
    return them sorted highest-priority first. See design spec §2 for the
    rule-based scoring rationale.
    """
    now = datetime.now(timezone.utc)
    items: list[EnquiryTriageItem] = []

    for enquiry in enquiries:
        days_waiting = max((now - enquiry.created_at).days, 0)
        score = float(min(days_waiting, 30))
        reasons: list[str] = [f"Waiting {days_waiting} day{'s' if days_waiting != 1 else ''}"]

        if enquiry.follow_up_date is not None:
            follow_up_days = (now - enquiry.follow_up_date).days
            if follow_up_days > 0:
                score += 50
                reasons.append(f"Follow-up overdue by {follow_up_days} day{'s' if follow_up_days != 1 else ''}")
            elif follow_up_days == 0:
                score += 20
                reasons.append("Follow-up due today")

        if enquiry.diagnosis_report_url:
            score += 10
            reasons.append("Diagnosis report attached")

        if enquiry.concerns:
            score += len(enquiry.concerns) * 2
            reasons.append(f"{len(enquiry.concerns)} concern{'s' if len(enquiry.concerns) != 1 else ''} noted")

        items.append(
            EnquiryTriageItem(
                enquiry_id=enquiry.id,
                parent_name=enquiry.parent_name,
                child_name=enquiry.child_name,
                priority_score=score,
                reasons=reasons,
                days_waiting=days_waiting,
                follow_up_date=enquiry.follow_up_date,
            )
        )

    items.sort(key=lambda item: item.priority_score, reverse=True)
    return items
```

- [ ] **Step 5: Create the router**

`services/ai-service/app/enquiry_triage.py`:

```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.clients.client_records_client import ClientRecordsApiClient
from app.config import settings
from app.schemas import EnquiryTriageResponse
from app.tenancy import get_tenant_id
from app.triage import rank_enquiries

router = APIRouter()


@router.get("/enquiry-triage", response_model=EnquiryTriageResponse)
async def get_enquiry_triage(tenant_id: str = Depends(get_tenant_id)) -> EnquiryTriageResponse:
    client = ClientRecordsApiClient(settings.client_records_api_base_url)
    enquiries = await client.get_submitted_enquiries(tenant_id)
    items = rank_enquiries(enquiries)
    return EnquiryTriageResponse(items=items, generated_at=datetime.now(timezone.utc))
```

- [ ] **Step 6: Wire the router into `main.py`**

In `services/ai-service/app/main.py`, add this import right after the existing `from app.suggestions import router as suggestions_router` line:

```python
from app.enquiry_triage import router as enquiry_triage_router
```

Add this line right after the existing `app.include_router(suggestions_router)` line:

```python
app.include_router(enquiry_triage_router)
```

- [ ] **Step 7: Manual smoke check**

Confirm the service starts and the new route is registered. Use whatever this repo's established local-run command for `ai-service` is (check `services/ai-service/README.md` or existing dev-run scripts if unclear — this session hasn't needed to run `ai-service` locally before, unlike the .NET services, so don't assume `dotnet run`-style commands apply). At minimum:

```bash
cd services/ai-service
python -m pytest tests/ -v
```

Expected: the **existing** test suite still passes unchanged (this step is a regression check on the existing `tests/test_*.py` files, not new test-writing — no new test files were created in this task). If `ai-service` has a way to start the FastAPI app locally (e.g. `uvicorn app.main:app`), start it and hit `GET /enquiry-triage` with an `X-Tenant-Id` header to confirm it returns `200` with an empty `items` list (no `ClientRecordsApi` running locally in this smoke check, so the client correctly fails open to an empty list rather than erroring).

- [ ] **Step 8: Commit**

```bash
git add services/ai-service/app/clients/client_records_client.py services/ai-service/app/schemas.py services/ai-service/app/triage.py services/ai-service/app/enquiry_triage.py services/ai-service/app/config.py services/ai-service/app/main.py
git commit -m "feat(ai-service): add GET /enquiry-triage, Phase 7's first scoped AI feature (tests deferred to later pass)"
```

---

## Definition of done for this plan

- [ ] The existing `ai-service` test suite (`tests/test_*.py`) passes unchanged
- [ ] `GET /enquiry-triage` correctly fails open (empty `items` list) when `ClientRecordsApi` is unreachable
- [ ] The commit from this plan is present in `git log`
- [ ] **Test coverage for this sub-project remains outstanding** — tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier
- [ ] The `pageSize=100` cap and the missing Alembic migration tooling (both pre-existing, not introduced here) stay documented in `DEFERRED-AND-TODO.md`, not silently carried forward unremarked
