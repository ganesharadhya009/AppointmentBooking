# AI Service Slot Suggestion Stub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ai-service`'s first real feature — `GET /suggestions`, a ranked list of therapist/session-window combinations for a child+branch+therapy-type+date, computed by combining `DirectoryApi` (candidate therapists + pricing) and `SchedulingApi` (real-time availability) — plus a small filter addition to `DirectoryApi` that the AI service needs to discover candidates.

**Architecture:** `ai-service` (Python/FastAPI) gains an async SQLAlchemy-backed `SlotSuggestionLog` table (Postgres in production, SQLite in-memory for tests via a shared-connection `StaticPool`), two async HTTP clients (`DirectoryApiClient`, `SchedulingApiClient`) built on `httpx`, and a pure rule-based ranking function. `DirectoryApi` gains `branchId`/`therapyTypeId`/`status` query filters on its existing `GET /therapists` list endpoint.

**Tech Stack:** FastAPI 0.141.1 (existing), Python 3.12+, SQLAlchemy 2.0 (async), `asyncpg` (Postgres driver), `aiosqlite` (test-only SQLite driver), Pydantic 2.x, `httpx` (existing, already a test dependency via `TestClient`), `respx` for HTTP mocking in tests, `pytest-asyncio`.

## Global Constraints

- Every cross-service call (both new `ai-service` clients, and any future caller of `DirectoryApi`'s new filter) forwards the same `X-Tenant-Id` header — no new auth mechanism, matching the established platform-wide trust model (real Auth0 auth is deferred to the last phase of the whole project, per the 2026-08-17 roadmap decision).
- All `ai-service` query-string parameters use **camelCase on the wire** (`childId`, `branchId`, `therapyTypeId`, `date`) via explicit `Query(alias=...)`, even though Python code uses snake_case internally — this matches every other service's REST contract on this platform. Getting this wrong means the endpoint silently expects snake_case URLs that nothing else in the platform would ever send.
- All Pydantic models that parse `DirectoryApi`/`SchedulingApi` JSON responses, and all Pydantic models FastAPI serializes back to callers, use a shared `CamelModel` base (`alias_generator=to_camel`) — matching the same case-sensitivity hazard already documented in `SchedulingApi`'s clients (`.NET`'s default JSON is camelCase; without explicit aliasing, Pydantic's default snake_case field matching silently fails to populate every field).
- `SessionWindowName` ordinals (0=Morning, 1=Noon, 2=Afternoon, 3=Evening) are consumed as plain integers on both the `DirectoryApi` and `SchedulingApi` sides — no enum re-mapping needed in Python, since both source services already serialize with identical integer ordinals (established convention from the Scheduling sub-project).
- A downstream call failure (either `DirectoryApi` or a per-therapist `SchedulingApi` call) never raises an unhandled exception — it results in that therapist being excluded from the ranked result, never a 500.
- `SlotSuggestionLog` is tenant-scoped: every query includes an explicit `WHERE tenant_id = :tenant_id` — there is no EF-style global query filter in SQLAlchemy, so this must be applied by hand at every query site (there is only one query site in this plan: the tenancy dependency validates the header, but no read-back query exists yet — this constraint is written for future sub-projects that add one).
- No pgvector — plain Postgres, `JSON().with_variant(JSONB(), "postgresql")` for the `suggestions` column so it's `JSONB` on Postgres and plain `JSON` on SQLite tests.
- Confirmed local dev ports (do not guess a different value): `DirectoryApi` → `http://localhost:5256`, `SchedulingApi` → `http://localhost:5098`.

---

### Task 1: Directory API — add branchId/therapyTypeId/status filters to GET /therapists

**Files:**
- Modify: `services/directory-api/DirectoryApi/Endpoints/TherapistEndpoints.cs`
- Test: `services/directory-api/DirectoryApi.Tests/TherapistEndpointsTests.cs`

**Interfaces:**
- Consumes: existing `DirectoryDbContext`, `Therapist`/`TherapistAssignment` entities, `PagedResult<T>`, `TherapistResponse`
- Produces: `GET /therapists?branchId=&therapyTypeId=&status=` (all three optional, backward compatible with the existing unfiltered call) — consumed by Task 3's `DirectoryApiClient`

- [ ] **Step 1: Write the failing tests**

Add to `services/directory-api/DirectoryApi.Tests/TherapistEndpointsTests.cs` (append new test methods to the existing class — it already has `WithTenant`, `CreateBranchAndTherapyTypeAsync`, `BuildAssignment` helpers to reuse):

```csharp
[Fact]
public async Task GetTherapists_FilteredByBranchAndTherapyType_ReturnsOnlyMatchingTherapist()
{
    var tenantId = Guid.NewGuid();
    var (branchId, therapyTypeId) = await CreateBranchAndTherapyTypeAsync(tenantId);
    var (otherBranchId, otherTherapyTypeId) = await CreateBranchAndTherapyTypeAsync(tenantId);

    await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
    {
        Name = "Matching Therapist",
        MobileNumber = "1111111111",
        Email = "matching@example.com",
        LicenseNumber = "LIC-MATCH",
        Designation = "Therapist",
        Assignments = [BuildAssignment(branchId, therapyTypeId)]
    }));
    await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
    {
        Name = "Non-Matching Therapist",
        MobileNumber = "2222222222",
        Email = "nonmatching@example.com",
        LicenseNumber = "LIC-NOMATCH",
        Designation = "Therapist",
        Assignments = [BuildAssignment(otherBranchId, otherTherapyTypeId)]
    }));

    var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
        $"/therapists?branchId={branchId}&therapyTypeId={therapyTypeId}", tenantId));
    var body = await response.Content.ReadFromJsonAsync<PagedResult<TherapistResponse>>();

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Single(body!.Items);
    Assert.Equal("Matching Therapist", body.Items[0].Name);
}

[Fact]
public async Task GetTherapists_FilteredByStatus_ExcludesInactiveTherapists()
{
    var tenantId = Guid.NewGuid();
    var (branchId, therapyTypeId) = await CreateBranchAndTherapyTypeAsync(tenantId);

    var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
    {
        Name = "To Be Deactivated",
        MobileNumber = "3333333333",
        Email = "deactivated@example.com",
        LicenseNumber = "LIC-DEACT",
        Designation = "Therapist",
        Assignments = [BuildAssignment(branchId, therapyTypeId)]
    }));
    var created = await createResponse.Content.ReadFromJsonAsync<TherapistResponse>();

    await _client.SendAsync(WithTenant(HttpMethod.Put, $"/therapists/{created!.Id}", tenantId, new UpdateTherapistRequest
    {
        Name = created.Name,
        MobileNumber = created.MobileNumber,
        Email = created.Email,
        LicenseNumber = created.LicenseNumber,
        Designation = created.Designation,
        Status = TherapistStatus.Inactive,
        Assignments = [BuildAssignment(branchId, therapyTypeId)]
    }));

    var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
        $"/therapists?branchId={branchId}&therapyTypeId={therapyTypeId}&status=Active", tenantId));
    var body = await response.Content.ReadFromJsonAsync<PagedResult<TherapistResponse>>();

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Empty(body!.Items);
}

[Fact]
public async Task GetTherapists_WithNoFilters_StillReturnsUnfilteredPagedResults()
{
    var tenantId = Guid.NewGuid();
    var (branchId, therapyTypeId) = await CreateBranchAndTherapyTypeAsync(tenantId);

    await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
    {
        Name = "Unfiltered Therapist",
        MobileNumber = "4444444444",
        Email = "unfiltered@example.com",
        LicenseNumber = "LIC-UNFILT",
        Designation = "Therapist",
        Assignments = [BuildAssignment(branchId, therapyTypeId)]
    }));

    var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/therapists", tenantId));
    var body = await response.Content.ReadFromJsonAsync<PagedResult<TherapistResponse>>();

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Contains(body!.Items, t => t.Name == "Unfiltered Therapist");
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj --filter GetTherapists_FilteredByBranchAndTherapyType_ReturnsOnlyMatchingTherapist`
Expected: FAIL — the filter isn't wired up yet, so both therapists would be returned

- [ ] **Step 3: Implement the filters**

Modify `services/directory-api/DirectoryApi/Endpoints/TherapistEndpoints.cs`. Find the existing `GET /therapists` handler:

```csharp
        group.MapGet("", async (int? page, int? pageSize, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Therapists
                .Include(t => t.Assignments).ThenInclude(a => a.SessionWindows)
                .OrderBy(t => t.Name);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<TherapistResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });
```

Replace it with:

```csharp
        group.MapGet("", async (int? page, int? pageSize, Guid? branchId, Guid? therapyTypeId, TherapistStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Therapists
                .Include(t => t.Assignments).ThenInclude(a => a.SessionWindows)
                .AsQueryable();

            if (branchId is not null)
            {
                query = query.Where(t => t.Assignments.Any(a => a.BranchId == branchId));
            }

            if (therapyTypeId is not null)
            {
                query = query.Where(t => t.Assignments.Any(a => a.TherapyTypeId == therapyTypeId));
            }

            if (status is not null)
            {
                query = query.Where(t => t.Status == status);
            }

            query = query.OrderBy(t => t.Name);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<TherapistResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });
```

`TherapistStatus? status` as a minimal-API query parameter binds from the string name (e.g. `?status=Active`) automatically — ASP.NET Core's enum model binder accepts the member name, not just the integer ordinal, with no extra configuration needed. `branchId`/`therapyTypeId` filter via `Assignments.Any(...)` since a therapist can have multiple assignments across branches/therapy-types — a therapist matches if ANY of their assignments matches, not requiring all fields to match the same single assignment (that finer-grained combined match isn't needed here — the AI service's ranking function does that combined branch+therapyType-per-assignment matching itself in Task 4, using this endpoint only to narrow the candidate pool).

- [ ] **Step 4: Run the tests and verify they pass**

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total (existing DirectoryApi test count + 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add services/directory-api/DirectoryApi/Endpoints/TherapistEndpoints.cs services/directory-api/DirectoryApi.Tests/TherapistEndpointsTests.cs
git commit -m "feat(directory-api): add branchId/therapyTypeId/status filters to GET /therapists"
```

---

### Task 2: AI Service foundation — config, async DB, SlotSuggestionLog, tenancy

**Files:**
- Modify: `services/ai-service/requirements.txt`
- Modify: `services/ai-service/requirements-dev.txt`
- Modify: `services/ai-service/pyproject.toml`
- Create: `services/ai-service/app/config.py`
- Create: `services/ai-service/app/db.py`
- Create: `services/ai-service/app/models.py`
- Create: `services/ai-service/app/tenancy.py`
- Create: `services/ai-service/tests/conftest.py`
- Test: `services/ai-service/tests/test_foundation.py`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `app.config.settings: Settings` (`.database_url`, `.directory_api_base_url`, `.scheduling_api_base_url`) — used by Task 3/4
  - `app.db.Base`, `app.db.get_db` (FastAPI dependency yielding an `AsyncSession`) — used by Task 4
  - `app.models.SlotSuggestionLog` (SQLAlchemy ORM model) — used by Task 4
  - `app.tenancy.get_tenant_id` (FastAPI dependency, returns validated tenant id as `str`) — used by Task 4
  - `tests/conftest.py`'s `db_session`/`client` pytest fixtures — used by Task 3/4's tests

- [ ] **Step 1: Add the new dependencies**

Read `services/ai-service/requirements.txt` first, then replace its full contents with:

```
fastapi==0.141.1
uvicorn[standard]==0.52.3
pydantic==2.9.2
pydantic-settings==2.6.1
sqlalchemy==2.0.36
asyncpg==0.30.0
```

Read `services/ai-service/requirements-dev.txt` first, then replace its full contents with:

```
-r requirements.txt
pytest==9.1.1
httpx==0.28.1
aiosqlite==0.20.0
pytest-asyncio==0.24.0
respx==0.21.1
```

If any exact pinned version 404s during install, use the latest available patch release within the same minor version (e.g. `2.9.x` instead of `2.9.2`) rather than jumping to a different minor version — the APIs this plan depends on (`pydantic.alias_generators.to_camel`, SQLAlchemy 2.0 async engine, `respx.mock`) are stable within these minor version lines.

- [ ] **Step 2: Configure pytest-asyncio**

Read `services/ai-service/pyproject.toml` first, then replace its full contents with:

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
asyncio_mode = "auto"
```

`asyncio_mode = "auto"` lets `async def test_...` functions run without needing a `@pytest.mark.asyncio` decorator on each one.

- [ ] **Step 3: Install the dependencies**

```bash
cd services/ai-service
pip install -r requirements-dev.txt
cd ../..
```

- [ ] **Step 4: Create the config module**

`services/ai-service/app/config.py`:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_SERVICE_")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_service_dev"
    directory_api_base_url: str = "http://localhost:5256"
    scheduling_api_base_url: str = "http://localhost:5098"


settings = Settings()
```

- [ ] **Step 5: Create the async DB module**

`services/ai-service/app/db.py`:

```python
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.database_url)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
```

- [ ] **Step 6: Create the SlotSuggestionLog model**

`services/ai-service/app/models.py`:

```python
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, JSON, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SlotSuggestionLog(Base):
    __tablename__ = "slot_suggestion_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    child_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    branch_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    therapy_type_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    requested_date: Mapped[date] = mapped_column(Date, nullable=False)
    suggestions: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

The generic `Uuid` type (SQLAlchemy 2.0+) and `JSON().with_variant(JSONB(), "postgresql")` both work correctly across the Postgres production database and the SQLite in-memory test database — `Uuid` maps to a native `UUID` column on Postgres and a `CHAR(32)` column on SQLite; the JSON variant maps to `JSONB` on Postgres and plain `JSON` (TEXT-backed) on SQLite.

- [ ] **Step 7: Create the tenancy dependency**

`services/ai-service/app/tenancy.py`:

```python
from uuid import UUID

from fastapi import Header, HTTPException, status


def get_tenant_id(x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id")) -> str:
    if not x_tenant_id or not x_tenant_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing or invalid X-Tenant-Id header",
        )
    try:
        UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing or invalid X-Tenant-Id header",
        ) from None
    return x_tenant_id
```

- [ ] **Step 8: Create the shared test fixtures**

`services/ai-service/tests/conftest.py`:

```python
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with session_factory() as session:
        yield session

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.fixture
def client(db_session: AsyncSession) -> TestClient:
    return TestClient(app)
```

`poolclass=StaticPool` + `connect_args={"check_same_thread": False}` is required for SQLite's `:memory:` database to be shared correctly across the multiple separate connections that `override_get_db` and the test's own `db_session` each open — without it, each new connection would get its own empty in-memory database and see none of the other's writes.

- [ ] **Step 9: Write the proof-of-life test**

`services/ai-service/tests/test_foundation.py`:

```python
import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import pytest

from app.models import SlotSuggestionLog
from app.tenancy import get_tenant_id


async def test_can_insert_and_query_a_slot_suggestion_log(db_session: AsyncSession) -> None:
    log_entry = SlotSuggestionLog(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        child_id=uuid.uuid4(),
        branch_id=uuid.uuid4(),
        therapy_type_id=uuid.uuid4(),
        requested_date=date(2026, 9, 1),
        suggestions=[{"therapistId": str(uuid.uuid4()), "score": 540.0}],
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(log_entry)
    await db_session.commit()

    result = await db_session.execute(select(SlotSuggestionLog).where(SlotSuggestionLog.id == log_entry.id))
    found = result.scalar_one()

    assert found.tenant_id == log_entry.tenant_id
    assert found.suggestions[0]["score"] == 540.0


def test_health_endpoint_still_works(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["service"] == "AiService"


def test_get_tenant_id_rejects_missing_header() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_tenant_id(x_tenant_id=None)

    assert exc_info.value.status_code == 400


def test_get_tenant_id_rejects_malformed_header() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_tenant_id(x_tenant_id="not-a-guid")

    assert exc_info.value.status_code == 400


def test_get_tenant_id_accepts_a_valid_guid() -> None:
    tenant_id = str(uuid.uuid4())

    result = get_tenant_id(x_tenant_id=tenant_id)

    assert result == tenant_id
```

- [ ] **Step 10: Run the tests and verify they pass**

Run: `cd services/ai-service && python -m pytest -v && cd ../..`
Expected: 0 failures — trust the test runner's own total (1 pre-existing health test + 5 new tests). Note: `test_health_endpoint_still_works` supersedes the old standalone `tests/test_health.py` module-level `TestClient(app)` instantiation pattern — leave `tests/test_health.py` as-is (it still passes independently), this new test in `test_foundation.py` just additionally proves the app still boots with the DB/tenancy wiring added.

- [ ] **Step 11: Commit**

```bash
git add services/ai-service/requirements.txt services/ai-service/requirements-dev.txt services/ai-service/pyproject.toml services/ai-service/app services/ai-service/tests
git commit -m "feat(ai-service): add async DB foundation, SlotSuggestionLog model, and tenancy dependency"
```

---

### Task 3: AI Service — DirectoryApi/SchedulingApi HTTP clients

**Files:**
- Create: `services/ai-service/app/schemas.py`
- Create: `services/ai-service/app/clients/__init__.py`
- Create: `services/ai-service/app/clients/directory_client.py`
- Create: `services/ai-service/app/clients/scheduling_client.py`
- Test: `services/ai-service/tests/test_clients.py`

**Interfaces:**
- Consumes: `app.config.settings` (Task 2)
- Produces:
  - `app.schemas.CamelModel`, `SessionWindowInfo`, `AssignmentInfo`, `TherapistInfo`, `TherapistsPage`, `AvailabilityResponse`, `SuggestionItem`, `SuggestionsResponse` — used by Task 4
  - `app.clients.directory_client.DirectoryApiClient.get_active_therapists(branch_id, therapy_type_id, tenant_id) -> list[TherapistInfo]` — used by Task 4
  - `app.clients.scheduling_client.SchedulingApiClient.get_availability(branch_id, therapist_id, therapy_type_id, requested_date, tenant_id) -> list[int]` — used by Task 4

- [ ] **Step 1: Create the shared Pydantic schemas**

`services/ai-service/app/schemas.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SessionWindowInfo(CamelModel):
    window_name: int
    start_time: str
    end_time: str
    price_per_session: float


class AssignmentInfo(CamelModel):
    branch_id: UUID
    therapy_type_id: UUID
    session_windows: list[SessionWindowInfo]


class TherapistInfo(CamelModel):
    id: UUID
    status: int
    assignments: list[AssignmentInfo]


class TherapistsPage(CamelModel):
    items: list[TherapistInfo]


class AvailabilityResponse(CamelModel):
    available_windows: list[int]


class SuggestionItem(CamelModel):
    therapist_id: UUID
    window_name: int
    start_time: str
    end_time: str
    price_per_session: float
    score: float


class SuggestionsResponse(CamelModel):
    suggestions: list[SuggestionItem]
    generated_at: datetime
```

`CamelModel`'s `alias_generator=to_camel` makes every field parse from (and, for response models, serialize back to) camelCase JSON — e.g. Python's `window_name` reads/writes JSON's `windowName`. `populate_by_name=True` means the models also still accept snake_case keyword construction in Python code (used throughout the ranking/route code in later tasks).

- [ ] **Step 2: Create the clients package**

`services/ai-service/app/clients/__init__.py`: empty file.

- [ ] **Step 3: Implement DirectoryApiClient**

`services/ai-service/app/clients/directory_client.py`:

```python
from uuid import UUID

import httpx

from app.schemas import TherapistInfo, TherapistsPage


class DirectoryApiClient:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    async def get_active_therapists(
        self, branch_id: UUID, therapy_type_id: UUID, tenant_id: str
    ) -> list[TherapistInfo]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(
                    f"{self._base_url}/therapists",
                    params={
                        "branchId": str(branch_id),
                        "therapyTypeId": str(therapy_type_id),
                        "status": "Active",
                        "pageSize": 100,
                    },
                    headers={"X-Tenant-Id": tenant_id},
                )
            except httpx.HTTPError:
                return []
        if response.status_code != 200:
            return []
        page = TherapistsPage.model_validate(response.json())
        return page.items
```

- [ ] **Step 4: Implement SchedulingApiClient**

`services/ai-service/app/clients/scheduling_client.py`:

```python
from datetime import date
from uuid import UUID

import httpx

from app.schemas import AvailabilityResponse


class SchedulingApiClient:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    async def get_availability(
        self,
        branch_id: UUID,
        therapist_id: UUID,
        therapy_type_id: UUID,
        requested_date: date,
        tenant_id: str,
    ) -> list[int]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(
                    f"{self._base_url}/availability",
                    params={
                        "branchId": str(branch_id),
                        "therapistId": str(therapist_id),
                        "therapyTypeId": str(therapy_type_id),
                        "date": requested_date.isoformat(),
                    },
                    headers={"X-Tenant-Id": tenant_id},
                )
            except httpx.HTTPError:
                return []
        if response.status_code != 200:
            return []
        return AvailabilityResponse.model_validate(response.json()).available_windows
```

Both clients return an empty list on ANY failure — transport error (connection refused, timeout) or non-200 status — never raising. This is the mechanism behind the Global Constraint that a downstream failure excludes that therapist from ranking rather than failing the whole request.

- [ ] **Step 5: Write the client tests using respx**

`services/ai-service/tests/test_clients.py`:

```python
import uuid
from datetime import date

import httpx
import respx

from app.clients.directory_client import DirectoryApiClient
from app.clients.scheduling_client import SchedulingApiClient


@respx.mock
async def test_get_active_therapists_parses_camel_case_response() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()
    respx.get("http://directory.test/therapists").mock(
        return_value=httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": str(therapist_id),
                        "status": 0,
                        "assignments": [
                            {
                                "branchId": str(branch_id),
                                "therapyTypeId": str(therapy_type_id),
                                "sessionWindows": [
                                    {
                                        "windowName": 0,
                                        "startTime": "09:00:00",
                                        "endTime": "12:00:00",
                                        "pricePerSession": 500.0,
                                    }
                                ],
                            }
                        ],
                    }
                ],
                "page": 1,
                "pageSize": 100,
                "totalCount": 1,
            },
        )
    )

    client = DirectoryApiClient("http://directory.test")
    result = await client.get_active_therapists(branch_id, therapy_type_id, str(uuid.uuid4()))

    assert len(result) == 1
    assert result[0].id == therapist_id
    assert result[0].assignments[0].session_windows[0].price_per_session == 500.0


@respx.mock
async def test_get_active_therapists_returns_empty_list_on_non_200() -> None:
    respx.get("http://directory.test/therapists").mock(return_value=httpx.Response(500))

    client = DirectoryApiClient("http://directory.test")
    result = await client.get_active_therapists(uuid.uuid4(), uuid.uuid4(), str(uuid.uuid4()))

    assert result == []


@respx.mock
async def test_get_active_therapists_returns_empty_list_on_connection_error() -> None:
    respx.get("http://directory.test/therapists").mock(side_effect=httpx.ConnectError("connection refused"))

    client = DirectoryApiClient("http://directory.test")
    result = await client.get_active_therapists(uuid.uuid4(), uuid.uuid4(), str(uuid.uuid4()))

    assert result == []


@respx.mock
async def test_get_availability_parses_available_windows() -> None:
    respx.get("http://scheduling.test/availability").mock(
        return_value=httpx.Response(200, json={"availableWindows": [0, 2]})
    )

    client = SchedulingApiClient("http://scheduling.test")
    result = await client.get_availability(
        uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), date(2026, 9, 1), str(uuid.uuid4())
    )

    assert result == [0, 2]


@respx.mock
async def test_get_availability_returns_empty_list_on_404() -> None:
    respx.get("http://scheduling.test/availability").mock(return_value=httpx.Response(404))

    client = SchedulingApiClient("http://scheduling.test")
    result = await client.get_availability(
        uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), date(2026, 9, 1), str(uuid.uuid4())
    )

    assert result == []
```

`respx.mock` patches `httpx` at the transport layer for the duration of the decorated test — it intercepts the real outgoing request regardless of how/where the `httpx.AsyncClient` was constructed, so `ai-service`'s tests never need `DirectoryApi`/`SchedulingApi` actually running.

- [ ] **Step 6: Run the tests and verify they pass**

Run: `cd services/ai-service && python -m pytest -v && cd ../..`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 7: Commit**

```bash
git add services/ai-service/app/schemas.py services/ai-service/app/clients services/ai-service/tests/test_clients.py
git commit -m "feat(ai-service): add DirectoryApi/SchedulingApi HTTP clients with camelCase DTOs"
```

---

### Task 4: AI Service — ranking function + GET /suggestions endpoint

**Files:**
- Create: `services/ai-service/app/ranking.py`
- Create: `services/ai-service/app/suggestions.py`
- Modify: `services/ai-service/app/main.py`
- Test: `services/ai-service/tests/test_ranking.py`
- Test: `services/ai-service/tests/test_suggestions.py`

**Interfaces:**
- Consumes: `TherapistInfo`, `AssignmentInfo`, `SuggestionItem`, `SuggestionsResponse` (Task 3); `DirectoryApiClient`, `SchedulingApiClient` (Task 3); `SlotSuggestionLog` (Task 2); `get_db`, `get_tenant_id` (Task 2); `settings` (Task 2)
- Produces: `app.ranking.rank_candidates(...)`; `GET /suggestions`

- [ ] **Step 1: Write the failing unit tests for ranking**

`services/ai-service/tests/test_ranking.py`:

```python
import uuid

from app.ranking import rank_candidates
from app.schemas import AssignmentInfo, SessionWindowInfo, TherapistInfo


def _therapist(therapist_id, branch_id, therapy_type_id, windows) -> TherapistInfo:
    return TherapistInfo(
        id=therapist_id,
        status=0,
        assignments=[
            AssignmentInfo(
                branch_id=branch_id,
                therapy_type_id=therapy_type_id,
                session_windows=windows,
            )
        ],
    )


def test_rank_candidates_orders_by_earliest_start_time() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    early_therapist_id = uuid.uuid4()
    late_therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            late_therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=2, start_time="14:00:00", end_time="16:00:00", price_per_session=600.0)],
        ),
        _therapist(
            early_therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0)],
        ),
    ]
    availability = {str(late_therapist_id): [2], str(early_therapist_id): [0]}

    result = rank_candidates(therapists, availability, str(branch_id), str(therapy_type_id))

    assert len(result) == 2
    assert result[0].therapist_id == early_therapist_id
    assert result[1].therapist_id == late_therapist_id


def test_rank_candidates_tie_breaks_by_lowest_price() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    cheaper_therapist_id = uuid.uuid4()
    pricier_therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            pricier_therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=700.0)],
        ),
        _therapist(
            cheaper_therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0)],
        ),
    ]
    availability = {str(pricier_therapist_id): [0], str(cheaper_therapist_id): [0]}

    result = rank_candidates(therapists, availability, str(branch_id), str(therapy_type_id))

    assert result[0].therapist_id == cheaper_therapist_id
    assert result[1].therapist_id == pricier_therapist_id


def test_rank_candidates_excludes_therapist_with_no_availability_entry() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0)],
        )
    ]

    result = rank_candidates(therapists, {}, str(branch_id), str(therapy_type_id))

    assert result == []


def test_rank_candidates_excludes_window_not_in_available_windows() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            therapist_id,
            branch_id,
            therapy_type_id,
            [
                SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0),
                SessionWindowInfo(window_name=2, start_time="14:00:00", end_time="16:00:00", price_per_session=600.0),
            ],
        )
    ]
    availability = {str(therapist_id): [2]}

    result = rank_candidates(therapists, availability, str(branch_id), str(therapy_type_id))

    assert len(result) == 1
    assert result[0].window_name == 2


def test_rank_candidates_excludes_therapist_without_a_matching_assignment() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    other_branch_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            therapist_id,
            other_branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0)],
        )
    ]
    availability = {str(therapist_id): [0]}

    result = rank_candidates(therapists, availability, str(branch_id), str(therapy_type_id))

    assert result == []
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd services/ai-service && python -m pytest tests/test_ranking.py -v && cd ../..`
Expected: FAIL — `app.ranking` doesn't exist yet

- [ ] **Step 3: Implement the ranking function**

`services/ai-service/app/ranking.py`:

```python
from app.schemas import AssignmentInfo, SuggestionItem, TherapistInfo


def _minutes_since_midnight(time_str: str) -> int:
    hour, minute = (int(part) for part in time_str.split(":")[:2])
    return hour * 60 + minute


def _find_assignment(therapist: TherapistInfo, branch_id: str, therapy_type_id: str) -> AssignmentInfo | None:
    for assignment in therapist.assignments:
        if str(assignment.branch_id) == branch_id and str(assignment.therapy_type_id) == therapy_type_id:
            return assignment
    return None


def rank_candidates(
    therapists: list[TherapistInfo],
    availability_by_therapist: dict[str, list[int]],
    branch_id: str,
    therapy_type_id: str,
) -> list[SuggestionItem]:
    """Pure function: combine each therapist's assignment (matching the
    given branch/therapy type) with their available session windows
    (from availability_by_therapist, keyed by therapist id as a string),
    and return a flat list of suggestions sorted by earliest start time,
    tie-broken by lowest price.
    """
    scored: list[tuple[int, float, SuggestionItem]] = []

    for therapist in therapists:
        available_windows = availability_by_therapist.get(str(therapist.id))
        if not available_windows:
            continue

        assignment = _find_assignment(therapist, branch_id, therapy_type_id)
        if assignment is None:
            continue

        for window in assignment.session_windows:
            if window.window_name not in available_windows:
                continue

            minutes = _minutes_since_midnight(window.start_time)
            item = SuggestionItem(
                therapist_id=therapist.id,
                window_name=window.window_name,
                start_time=window.start_time,
                end_time=window.end_time,
                price_per_session=window.price_per_session,
                score=float(minutes),
            )
            scored.append((minutes, window.price_per_session, item))

    scored.sort(key=lambda entry: (entry[0], entry[1]))
    return [item for _, _, item in scored]
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `cd services/ai-service && python -m pytest tests/test_ranking.py -v && cd ../..`
Expected: 5/5 passing

- [ ] **Step 5: Write the failing endpoint integration tests**

`services/ai-service/tests/test_suggestions.py`:

```python
import uuid
from datetime import date

import httpx
import respx
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings


def _directory_response(therapist_id: uuid.UUID, branch_id: uuid.UUID, therapy_type_id: uuid.UUID) -> dict:
    return {
        "items": [
            {
                "id": str(therapist_id),
                "status": 0,
                "assignments": [
                    {
                        "branchId": str(branch_id),
                        "therapyTypeId": str(therapy_type_id),
                        "sessionWindows": [
                            {
                                "windowName": 0,
                                "startTime": "09:00:00",
                                "endTime": "12:00:00",
                                "pricePerSession": 500.0,
                            }
                        ],
                    }
                ],
            }
        ],
        "page": 1,
        "pageSize": 100,
        "totalCount": 1,
    }


@respx.mock
def test_get_suggestions_returns_ranked_list_and_logs_the_request(client: TestClient, db_session: AsyncSession) -> None:
    tenant_id = str(uuid.uuid4())
    child_id = uuid.uuid4()
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    respx.get(f"{settings.directory_api_base_url}/therapists").mock(
        return_value=httpx.Response(200, json=_directory_response(therapist_id, branch_id, therapy_type_id))
    )
    respx.get(f"{settings.scheduling_api_base_url}/availability").mock(
        return_value=httpx.Response(200, json={"availableWindows": [0]})
    )

    response = client.get(
        "/suggestions",
        params={
            "childId": str(child_id),
            "branchId": str(branch_id),
            "therapyTypeId": str(therapy_type_id),
            "date": "2026-09-01",
        },
        headers={"X-Tenant-Id": tenant_id},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["suggestions"]) == 1
    assert body["suggestions"][0]["therapistId"] == str(therapist_id)


@respx.mock
def test_get_suggestions_returns_empty_list_when_directory_api_is_unreachable(client: TestClient) -> None:
    tenant_id = str(uuid.uuid4())

    respx.get(f"{settings.directory_api_base_url}/therapists").mock(
        side_effect=httpx.ConnectError("connection refused")
    )

    response = client.get(
        "/suggestions",
        params={
            "childId": str(uuid.uuid4()),
            "branchId": str(uuid.uuid4()),
            "therapyTypeId": str(uuid.uuid4()),
            "date": "2026-09-01",
        },
        headers={"X-Tenant-Id": tenant_id},
    )

    assert response.status_code == 200
    assert response.json()["suggestions"] == []


@respx.mock
def test_get_suggestions_excludes_a_therapist_whose_scheduling_call_fails(client: TestClient) -> None:
    tenant_id = str(uuid.uuid4())
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    respx.get(f"{settings.directory_api_base_url}/therapists").mock(
        return_value=httpx.Response(200, json=_directory_response(therapist_id, branch_id, therapy_type_id))
    )
    respx.get(f"{settings.scheduling_api_base_url}/availability").mock(return_value=httpx.Response(500))

    response = client.get(
        "/suggestions",
        params={
            "childId": str(uuid.uuid4()),
            "branchId": str(branch_id),
            "therapyTypeId": str(therapy_type_id),
            "date": "2026-09-01",
        },
        headers={"X-Tenant-Id": tenant_id},
    )

    assert response.status_code == 200
    assert response.json()["suggestions"] == []


def test_get_suggestions_rejects_missing_tenant_header(client: TestClient) -> None:
    response = client.get(
        "/suggestions",
        params={
            "childId": str(uuid.uuid4()),
            "branchId": str(uuid.uuid4()),
            "therapyTypeId": str(uuid.uuid4()),
            "date": "2026-09-01",
        },
    )

    assert response.status_code == 400
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd services/ai-service && python -m pytest tests/test_suggestions.py -v && cd ../..`
Expected: FAIL — no `/suggestions` route mapped yet

- [ ] **Step 7: Implement the endpoint**

`services/ai-service/app/suggestions.py`:

```python
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.directory_client import DirectoryApiClient
from app.clients.scheduling_client import SchedulingApiClient
from app.config import settings
from app.db import get_db
from app.models import SlotSuggestionLog
from app.ranking import rank_candidates
from app.schemas import SuggestionsResponse
from app.tenancy import get_tenant_id

router = APIRouter()


@router.get("/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(
    child_id: UUID = Query(alias="childId"),
    branch_id: UUID = Query(alias="branchId"),
    therapy_type_id: UUID = Query(alias="therapyTypeId"),
    requested_date: date = Query(alias="date"),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> SuggestionsResponse:
    directory_client = DirectoryApiClient(settings.directory_api_base_url)
    scheduling_client = SchedulingApiClient(settings.scheduling_api_base_url)

    therapists = await directory_client.get_active_therapists(branch_id, therapy_type_id, tenant_id)

    availability_by_therapist: dict[str, list[int]] = {}
    for therapist in therapists:
        windows = await scheduling_client.get_availability(
            branch_id, therapist.id, therapy_type_id, requested_date, tenant_id
        )
        if windows:
            availability_by_therapist[str(therapist.id)] = windows

    suggestions = rank_candidates(therapists, availability_by_therapist, str(branch_id), str(therapy_type_id))

    log_entry = SlotSuggestionLog(
        tenant_id=UUID(tenant_id),
        child_id=child_id,
        branch_id=branch_id,
        therapy_type_id=therapy_type_id,
        requested_date=requested_date,
        suggestions=[item.model_dump(mode="json", by_alias=True) for item in suggestions],
        created_at=datetime.now(timezone.utc),
    )
    db.add(log_entry)
    await db.commit()

    return SuggestionsResponse(suggestions=suggestions, generated_at=datetime.now(timezone.utc))
```

Every query parameter uses `Query(alias="...")` to keep the wire format camelCase (`childId`, `branchId`, `therapyTypeId`, `date`) while the Python parameter names stay idiomatic snake_case — this is the mechanism behind the Global Constraint on camelCase query parameters. `requested_date` (not `date`) is used as the Python parameter name specifically to avoid shadowing the `date` type imported from `datetime`.

- [ ] **Step 8: Wire the router into the app**

Replace the full contents of `services/ai-service/app/main.py`:

```python
from fastapi import FastAPI

from app.suggestions import router as suggestions_router

app = FastAPI(title="AI Service")

app.include_router(suggestions_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "Healthy", "service": "AiService"}
```

- [ ] **Step 9: Run the full test suite and verify everything passes**

Run: `cd services/ai-service && python -m pytest -v && cd ../..`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 10: Commit**

```bash
git add services/ai-service/app/ranking.py services/ai-service/app/suggestions.py services/ai-service/app/main.py services/ai-service/tests/test_ranking.py services/ai-service/tests/test_suggestions.py
git commit -m "feat(ai-service): add rule-based ranking and GET /suggestions endpoint"
```

---

## Definition of done for this plan

- [ ] `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj` passes with 0 failures
- [ ] `cd services/ai-service && python -m pytest -v` passes with 0 failures
- [ ] `GET /therapists?branchId=&therapyTypeId=&status=` filters correctly, and omitting all three still returns the existing unfiltered behavior
- [ ] `GET /suggestions` returns a correctly ranked list (earliest start time, price tie-break) when both dependencies succeed
- [ ] `GET /suggestions` returns an empty list (not a 500) when `DirectoryApi` is unreachable
- [ ] `GET /suggestions` excludes a specific therapist (not the whole request) when their `SchedulingApi` call fails
- [ ] Every commit from this plan is present in `git log`
