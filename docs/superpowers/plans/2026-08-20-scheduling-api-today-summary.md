# SchedulingApi Today Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /appointments/today-summary` to `SchedulingApi` — Phase 6's entire backend scope. Based on `docs/superpowers/specs/2026-08-20-scheduling-api-today-summary-design.md`.

**Architecture:** Task 1 adds a small new counting endpoint to `DirectoryApi`'s existing `LeaveRequestEndpoints.cs`. Task 2 adds the cross-service client method to `SchedulingApi` and the aggregation endpoint itself.

**Tech Stack:** .NET 9, EF Core 9.0.19. No new packages.

## Global Constraints

- **Review mode: single sonnet-tier reviewer per task, no separate final whole-branch review** — per the 2026-08-20 cost checkpoint. Read-only, no new entity, no money, no concurrency-sensitive writes.
- **Unit/integration test-writing is deferred to a later consolidated pass** (standing project policy). No new `[Fact]` tests. Acceptance per task: builds clean, existing suite passes unchanged.
- `GetActiveLeaveCountAsync` is **fail-open** (returns `null` on any downstream failure, never throws) — matching `IsBranchClosedAsync`/`IsTherapistOnLeaveAsync`. This is informational KPI data, not a booking gate.
- "Today" is `DateOnly.FromDateTime(DateTimeOffset.UtcNow.DateTime)` — server UTC, a known simplification (already tracked in `DEFERRED-AND-TODO.md` by this plan's own final step).

---

### Task 1: `DirectoryApi` — active-leave-count endpoint

**Files:**
- Modify: `services/directory-api/DirectoryApi/Endpoints/LeaveRequestEndpoints.cs`
- Modify: `services/directory-api/DirectoryApi/Dtos/LeaveRequestDtos.cs`

**Interfaces:**
- Produces: `GET /leave-requests/active-count?date=`, consumed by Task 2.

- [ ] **Step 1: Add the response DTO**

In `services/directory-api/DirectoryApi/Dtos/LeaveRequestDtos.cs`, add this class (anywhere in the file, alongside the other response DTOs):

```csharp
public class ActiveLeaveCountResponse
{
    public int ActiveCount { get; set; }
}
```

- [ ] **Step 2: Add the endpoint**

In `services/directory-api/DirectoryApi/Endpoints/LeaveRequestEndpoints.cs`, add this new route registration right after the existing `group.MapGet("/is-on-leave", ...)` block's closing `});`:

```csharp
        group.MapGet("/active-count", async (DateOnly date, DirectoryDbContext db) =>
        {
            var activeCount = await db.LeaveRequests.CountAsync(l =>
                l.Status == LeaveRequestStatus.Approved &&
                l.StartDate <= date &&
                l.EndDate >= date);
            return Results.Ok(new ActiveLeaveCountResponse { ActiveCount = activeCount });
        });
```

This mirrors the existing `/is-on-leave` handler's exact query shape, just counting instead of checking one `therapistId`.

- [ ] **Step 3: Build and run the existing test suite as a regression check**

Run: `dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: 71/71 passing, unchanged.

- [ ] **Step 4: Commit**

```bash
git add services/directory-api/DirectoryApi/Endpoints/LeaveRequestEndpoints.cs services/directory-api/DirectoryApi/Dtos/LeaveRequestDtos.cs
git commit -m "feat(directory-api): add GET /leave-requests/active-count for Phase 6 today-summary (tests deferred to later pass)"
```

---

### Task 2: `SchedulingApi` — `IDirectoryApiClient` method + today-summary endpoint

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`
- Modify: `services/scheduling-api/SchedulingApi/Program.cs`

**Interfaces:**
- Consumes: `DirectoryApi`'s `GET /leave-requests/active-count` (Task 1).
- Produces: `GET /appointments/today-summary`.

- [ ] **Step 1: Add `GetActiveLeaveCountAsync` to the interface**

In `services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`, add this line to the `IDirectoryApiClient` interface (alongside the existing methods), and this response class above it:

```csharp
public class ActiveLeaveCountResponse
{
    public int ActiveCount { get; set; }
}
```

```csharp
    Task<int?> GetActiveLeaveCountAsync(DateOnly date, Guid tenantId, CancellationToken cancellationToken = default);
```

- [ ] **Step 2: Implement it in `DirectoryApiClient`**

In `services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`, add this method (matching the existing `IsTherapistOnLeaveAsync`'s fail-open shape exactly):

```csharp
    public async Task<int?> GetActiveLeaveCountAsync(DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/leave-requests/active-count?date={date:yyyy-MM-dd}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return null;
        }
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }
        var result = await response.Content.ReadFromJsonAsync<ActiveLeaveCountResponse>(JsonOptions, cancellationToken);
        return result?.ActiveCount;
    }
```

- [ ] **Step 3: Implement it in `FakeDirectoryApiClient`**

In `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`, add this property and method:

```csharp
    public int? ActiveLeaveCountToReturn { get; set; }
```

```csharp
    public Task<int?> GetActiveLeaveCountAsync(DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(ActiveLeaveCountToReturn);
```

This is required for `FakeDirectoryApiClient` to still compile against the updated `IDirectoryApiClient` interface — infrastructure, not a new test, per the standing test-deferral policy.

- [ ] **Step 4: Add the response DTO and the endpoint**

In `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`, add this response class near the top of the file (alongside other response types, or in the existing `AppointmentReportDtos.cs`-style location — either is fine, this file already has inline response handling patterns from prior sub-projects):

```csharp
public class TodaySummaryResponse
{
    public int UpcomingCount { get; set; }
    public int CompletedCount { get; set; }
    public int CancelledCount { get; set; }
    public int OnLeaveCount { get; set; }
}
```

Add this new route registration inside `MapAppointmentEndpoints`, right after the existing `app.MapGet("/availability", ...)` block's closing `});` (before `var group = app.MapGroup("/appointments");`):

```csharp
        app.MapGet("/appointments/today-summary", async (SchedulingDbContext db, IDirectoryApiClient directoryClient, ITenantContext tenantContext) =>
        {
            var today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.DateTime);

            var upcomingCount = await db.Appointments.CountAsync(a => a.AppointmentDate == today && a.Status == AppointmentStatus.Planned)
                + await db.DoctorAppointments.CountAsync(a => a.AppointmentDate == today && a.Status == AppointmentStatus.Planned);

            var completedCount = await db.Appointments.CountAsync(a => a.AppointmentDate == today && a.Status == AppointmentStatus.Completed)
                + await db.DoctorAppointments.CountAsync(a => a.AppointmentDate == today && a.Status == AppointmentStatus.Completed);

            var cancelledCount = await db.Appointments.CountAsync(a => a.AppointmentDate == today && a.Status == AppointmentStatus.Cancelled)
                + await db.DoctorAppointments.CountAsync(a => a.AppointmentDate == today && a.Status == AppointmentStatus.Cancelled);

            var onLeaveCount = await directoryClient.GetActiveLeaveCountAsync(today, tenantContext.TenantId);

            return Results.Ok(new TodaySummaryResponse
            {
                UpcomingCount = upcomingCount,
                CompletedCount = completedCount,
                CancelledCount = cancelledCount,
                OnLeaveCount = onLeaveCount ?? 0
            });
        });
```

**Note the placement matters:** this must be registered as a top-level `app.MapGet(...)` (like the existing `/availability` endpoint just above it), not inside the `/appointments` route group — its path is `/appointments/today-summary`, and if it were added inside `group.MapGet("/{id:guid}", ...)`'s group, ASP.NET Core's routing would need `today-summary` to not collide with the `{id:guid}` constraint (it wouldn't, since `today-summary` isn't a valid GUID, so it would technically still work either way) — but registering it as a sibling top-level route alongside `/availability` matches this file's existing convention for routes that don't fit the `/appointments/{id}` CRUD shape, and avoids ever having to reason about the collision at all.

- [ ] **Step 5: Build and run the existing test suite as a regression check**

Run: `dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 49/49 passing, unchanged — the new interface method requires `FakeDirectoryApiClient` to compile (Step 3), which is necessary for the existing suite to even build; no new test methods are added.

- [ ] **Step 6: Manual smoke check**

```bash
cd services/scheduling-api/SchedulingApi
dotnet run &
sleep 5
curl -s http://localhost:5098/appointments/today-summary -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111"
kill %1
cd ../../..
```

Expected: `HTTP 200` with `{"upcomingCount":0,"completedCount":0,"cancelledCount":0,"onLeaveCount":0}` (empty tenant, `DirectoryApi` likely not running locally so `onLeaveCount` correctly fails open to `0` rather than erroring the whole response).

- [ ] **Step 7: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs
git commit -m "feat(scheduling-api): add GET /appointments/today-summary, closing Phase 6's backend scope (tests deferred to later pass)"
```

---

## Definition of done for this plan

- [ ] `dotnet build` succeeds with 0 errors on both `DirectoryApi` and `SchedulingApi`
- [ ] `dotnet test` — 71/71 (`DirectoryApi`) and 49/49 (`SchedulingApi`) passing, unchanged
- [ ] `GET /appointments/today-summary` correctly fails open (`onLeaveCount: 0`) when `DirectoryApi` is unreachable
- [ ] Both commits from this plan are present in `git log`
- [ ] **Test coverage for this sub-project remains outstanding** — tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier
- [ ] **This closes Phase 6's entire backend scope**
