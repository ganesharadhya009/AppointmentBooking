# Directory API Holiday Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-branch holiday closures to `DirectoryApi` and wire `SchedulingApi`'s availability/booking/reschedule paths to respect them — closing the gap the Phase 1 Scheduling spec explicitly flagged as deferred.

**Architecture:** `Holiday` is a new tenant-scoped entity on `DirectoryApi`, alongside `Branch`/`TherapyType`/`Therapist`. `SchedulingApi` gains a new `IDirectoryApiClient` method (`IsBranchClosedAsync`) following the exact same cross-service pattern already used for `GetBranchAsync`/`GetTherapistAsync`, wired into three existing endpoints with fail-open semantics on any downstream failure.

**Tech Stack:** .NET 9, EF Core 9.0.19 (already installed, no new packages).

## Global Constraints

- `Holiday` is tenant-scoped: EF Core query filter + `HasIndex(TenantId)` — the established convention.
- `Holiday` is **hard-deleted**, not soft-deleted — a deliberate deviation from `TherapyType`'s precedent (no downstream references exist to a `Holiday` row, no history value once removed).
- `[Required]` on `CreateHolidayRequest.Date` uses `DateOnly?` (nullable), not `DateOnly` — the established lesson: `[Required]` on a non-nullable value type is a documented no-op.
- Unique index on `(TenantId, BranchId, Date)`, enforced both at the app level (`AnyAsync` pre-check) and the DB level (`DbUpdateException` unique-violation catch, matching the pattern already established in `SchedulingApi`'s `AppointmentEndpoints.cs`), returning `409 Conflict` either way.
- `SchedulingApi`'s holiday check is **fail-open**: any failure (transport error or non-success status) resolves to "not closed," never blocking the booking flow on a `DirectoryApi` hiccup.
- Every error response is RFC 7807 via `Results.Problem(...)`/`Results.ValidationProblem(...)`.
- `X-Tenant-Id` forwarded on the new cross-service call, matching every other cross-service call in the codebase.

---

### Task 1: DirectoryApi — Holiday entity, CRUD, and the is-closed check endpoint

**Files:**
- Create: `services/directory-api/DirectoryApi/Entities/Holiday.cs`
- Modify: `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/HolidayDtos.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/HolidayEndpoints.cs`
- Modify: `services/directory-api/DirectoryApi/Program.cs`
- Create: `services/directory-api/DirectoryApi/Migrations/*`
- Test: `services/directory-api/DirectoryApi.Tests/HolidayEndpointsTests.cs`

**Interfaces:**
- Consumes: existing `DirectoryDbContext`, `PagedResult<T>`, `DataAnnotationsValidator`, `ITenantContext`
- Produces: `POST /holidays`, `GET /holidays`, `GET /holidays/is-closed`, `DELETE /holidays/{id}` — the `is-closed` endpoint is consumed by Task 2's `SchedulingApi` client

- [ ] **Step 1: Create the entity**

`services/directory-api/DirectoryApi/Entities/Holiday.cs`:

```csharp
namespace DirectoryApi.Entities;

public class Holiday
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public DateOnly Date { get; set; }
    public required string Reason { get; set; }
}
```

- [ ] **Step 2: Register the entity in the DbContext**

Modify `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`. Add this line right after the existing `public DbSet<TherapistSessionWindow> TherapistSessionWindows => Set<TherapistSessionWindow>();`:

```csharp
    public DbSet<Holiday> Holidays => Set<Holiday>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<TherapistSessionWindow>(w => { ... });` block:

```csharp
        modelBuilder.Entity<Holiday>(h =>
        {
            h.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            h.HasIndex(x => x.TenantId);
            h.HasIndex(x => new { x.TenantId, x.BranchId, x.Date }).IsUnique();
            h.Property(x => x.Reason).HasMaxLength(500);
        });
```

- [ ] **Step 3: Create the DTOs**

`services/directory-api/DirectoryApi/Dtos/HolidayDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace DirectoryApi.Dtos;

public class CreateHolidayRequest
{
    [Required]
    public Guid BranchId { get; set; }

    [Required]
    public DateOnly? Date { get; set; }

    [Required, MaxLength(500)]
    public required string Reason { get; set; }
}

public class HolidayResponse
{
    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public DateOnly Date { get; set; }
    public required string Reason { get; set; }
}

public class IsClosedResponse
{
    public bool IsClosed { get; set; }
}
```

`Date` is `DateOnly?` (nullable) even though the entity's field isn't — `[Required]` on a non-nullable value type is a no-op, the exact bug class already found and fixed once in `ClientRecordsApi`'s final review and flagged as still-unfixed elsewhere in `DirectoryApi` in `DEFERRED-AND-TODO.md`. New code must not repeat it.

- [ ] **Step 4: Implement the endpoints**

`services/directory-api/DirectoryApi/Endpoints/HolidayEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class HolidayEndpoints
{
    public static void MapHolidayEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/holidays");

        group.MapGet("", async (int? page, int? pageSize, Guid? branchId, DateOnly? from, DateOnly? to, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Holidays.AsQueryable();

            if (branchId is not null)
            {
                query = query.Where(h => h.BranchId == branchId);
            }

            if (from is not null)
            {
                query = query.Where(h => h.Date >= from);
            }

            if (to is not null)
            {
                query = query.Where(h => h.Date <= to);
            }

            query = query.OrderBy(h => h.Date);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<HolidayResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/is-closed", async (Guid branchId, DateOnly date, DirectoryDbContext db) =>
        {
            var isClosed = await db.Holidays.AnyAsync(h => h.BranchId == branchId && h.Date == date);
            return Results.Ok(new IsClosedResponse { IsClosed = isClosed });
        });

        group.MapPost("", async (CreateHolidayRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId);
            if (branch is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["branchId"] = ["Branch not found or does not belong to this tenant."]
                });
            }

            var duplicate = await db.Holidays.AnyAsync(h => h.BranchId == request.BranchId && h.Date == request.Date!.Value);
            if (duplicate)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Holiday already exists", detail: "A holiday already exists for this branch and date.");
            }

            var holiday = new Holiday
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                BranchId = request.BranchId,
                Date = request.Date!.Value,
                Reason = request.Reason
            };

            db.Holidays.Add(holiday);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Holiday already exists", detail: "A holiday already exists for this branch and date.");
            }

            return Results.Created($"/holidays/{holiday.Id}", ToResponse(holiday));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var holiday = await db.Holidays.FirstOrDefaultAsync(h => h.Id == id);
            if (holiday is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Holiday not found");
            }

            db.Holidays.Remove(holiday);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };

    private static HolidayResponse ToResponse(Holiday holiday) => new()
    {
        Id = holiday.Id,
        BranchId = holiday.BranchId,
        Date = holiday.Date,
        Reason = holiday.Reason
    };
}
```

- [ ] **Step 5: Map the endpoints in `Program.cs`**

Add this line right after the existing `app.MapTherapistEndpoints();` line in `services/directory-api/DirectoryApi/Program.cs`:

```csharp
app.MapHolidayEndpoints();
```

- [ ] **Step 6: Write the tests**

`services/directory-api/DirectoryApi.Tests/HolidayEndpointsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class HolidayEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public HolidayEndpointsTests(LocalDbTestFixture fixture)
    {
        _client = fixture.CreateClient();
    }

    private HttpRequestMessage WithTenant(HttpMethod method, string url, Guid tenantId, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return request;
    }

    private async Task<Guid> CreateBranchAsync(Guid tenantId)
    {
        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/branches", tenantId, new CreateBranchRequest
        {
            Name = "Test Branch For Holiday",
            WeeklyDayOff = DayOfWeek.Sunday,
            DiscountTiers =
            [
                new() { SessionCount = 10, DiscountPerSession = 50 },
                new() { SessionCount = 24, DiscountPerSession = 100 },
                new() { SessionCount = 48, DiscountPerSession = 150 },
                new() { SessionCount = 72, DiscountPerSession = 200 },
                new() { SessionCount = 96, DiscountPerSession = 250 }
            ]
        }));
        var branch = await response.Content.ReadFromJsonAsync<BranchResponse>();
        return branch!.Id;
    }

    [Fact]
    public async Task PostHoliday_ThenGetIsClosed_ReturnsTrue()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);

        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 10, 2),
            Reason = "Gandhi Jayanti"
        }));

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var isClosedResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/holidays/is-closed?branchId={branchId}&date=2026-10-02", tenantId));
        var body = await isClosedResponse.Content.ReadFromJsonAsync<IsClosedResponse>();

        Assert.True(body!.IsClosed);
    }

    [Fact]
    public async Task GetIsClosed_OnANonHolidayDate_ReturnsFalse()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/holidays/is-closed?branchId={branchId}&date=2026-10-03", tenantId));
        var body = await response.Content.ReadFromJsonAsync<IsClosedResponse>();

        Assert.False(body!.IsClosed);
    }

    [Fact]
    public async Task PostHoliday_WithCrossTenantBranch_ReturnsValidationProblem()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantA);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantB, new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 10, 2),
            Reason = "Cross-tenant attempt"
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostHoliday_DuplicateBranchAndDate_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);
        var request = new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 12, 25),
            Reason = "Christmas"
        };
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, request));

        var secondResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, request));

        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteHoliday_RemovesIt_IsClosedBecomesFalse()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 11, 1),
            Reason = "Test Holiday"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<HolidayResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/holidays/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var isClosedResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/holidays/is-closed?branchId={branchId}&date=2026-11-01", tenantId));
        var body = await isClosedResponse.Content.ReadFromJsonAsync<IsClosedResponse>();

        Assert.False(body!.IsClosed);
    }

    [Fact]
    public async Task GetHolidays_FilteredByBranchAndDateRange_ReturnsOnlyMatching()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);
        var otherBranchId = await CreateBranchAsync(tenantId);
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 8, 20),
            Reason = "In range"
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, new CreateHolidayRequest
        {
            BranchId = otherBranchId,
            Date = new DateOnly(2026, 8, 20),
            Reason = "Different branch"
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/holidays?branchId={branchId}&from=2026-08-01&to=2026-08-31", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<HolidayResponse>>();

        Assert.Single(body!.Items);
        Assert.Equal("In range", body.Items[0].Reason);
    }
}
```

- [ ] **Step 7: Generate the migration**

```bash
cd services/directory-api/DirectoryApi
dotnet ef migrations add AddHoliday --output-dir Migrations
cd ../../..
```

- [ ] **Step 8: Run the tests and verify they pass**

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 9: Commit**

```bash
git add services/directory-api/DirectoryApi/Entities/Holiday.cs services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs services/directory-api/DirectoryApi/Dtos/HolidayDtos.cs services/directory-api/DirectoryApi/Endpoints/HolidayEndpoints.cs services/directory-api/DirectoryApi/Program.cs services/directory-api/DirectoryApi/Migrations services/directory-api/DirectoryApi.Tests/HolidayEndpointsTests.cs
git commit -m "feat(directory-api): add Holiday entity with CRUD and is-closed check"
```

---

### Task 2: SchedulingApi — wire holiday-awareness into availability, booking, and reschedule

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/AvailabilityEndpointTests.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/AppointmentLifecycleTests.cs`

**Interfaces:**
- Consumes: `IDirectoryApiClient` (existing), Task 1's `GET /holidays/is-closed`
- Produces: `IDirectoryApiClient.IsBranchClosedAsync(Guid branchId, DateOnly date, Guid tenantId, CancellationToken)`

- [ ] **Step 1: Add the new client method to the interface**

Modify `services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`. Add this class right after the existing `BranchInfo` class:

```csharp
public class IsClosedResponse
{
    public bool IsClosed { get; set; }
}
```

Add this method to the `IDirectoryApiClient` interface, right after the existing `GetTherapistAsync` signature:

```csharp
    Task<bool?> IsBranchClosedAsync(Guid branchId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default);
```

- [ ] **Step 2: Implement it on `DirectoryApiClient`**

Add this method to `services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`, right after the existing `GetTherapistAsync` method:

```csharp
    public async Task<bool?> IsBranchClosedAsync(Guid branchId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/holidays/is-closed?branchId={branchId}&date={date:yyyy-MM-dd}");
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
        var result = await response.Content.ReadFromJsonAsync<IsClosedResponse>(JsonOptions, cancellationToken);
        return result?.IsClosed;
    }
```

This method wraps `SendAsync` in a try/catch for `HttpRequestException` — the existing `GetBranchAsync`/`GetTherapistAsync` methods on this class do NOT do this (a known, separately-tracked gap in `DEFERRED-AND-TODO.md`). This method needs it specifically because its fail-open contract (§4 of the design spec) requires distinguishing "call failed" from "call succeeded" — a transport-level exception must resolve to `null` (fail-open), not propagate uncaught. Do not "fix" the other two methods as part of this task — that's a separate, already-tracked cross-cutting concern.

- [ ] **Step 3: Update the fake client**

Modify `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`. Add this property right after the existing `TherapistToReturn` property:

```csharp
    public bool? IsBranchClosedToReturn { get; set; }
```

Add this method right after the existing `GetTherapistAsync` method:

```csharp
    public Task<bool?> IsBranchClosedAsync(Guid branchId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(IsBranchClosedToReturn);
```

`IsBranchClosedToReturn` defaults to `null` (the default for `bool?`), so every existing test that doesn't explicitly set it keeps its current behavior unchanged — `null` resolves to "not closed" via the fail-open check added below, exactly like today's implicit behavior before this task existed.

- [ ] **Step 4: Wire the check into `GET /availability`**

Modify `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`. Find the existing `/availability` handler:

```csharp
        app.MapGet("/availability", async (Guid branchId, Guid therapistId, Guid therapyTypeId, DateOnly date, SchedulingDbContext db, IDirectoryApiClient directoryClient, ITenantContext tenantContext) =>
        {
            var therapist = await directoryClient.GetTherapistAsync(therapistId, tenantContext.TenantId);
            if (therapist is null || therapist.Status != RemoteStatus.Active)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist not found");
            }

            var assignment = therapist.Assignments.FirstOrDefault(a => a.BranchId == branchId && a.TherapyTypeId == therapyTypeId);
            if (assignment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist is not assigned to this branch/therapy type");
            }

            var existingAppointments = await db.Appointments
```

Insert this block right after the `assignment is null` check, before `var existingAppointments = ...`:

```csharp
            var isClosed = await directoryClient.IsBranchClosedAsync(branchId, date, tenantContext.TenantId);
            if (isClosed == true)
            {
                return Results.Ok(new AvailabilityResponse { AvailableWindows = [] });
            }

```

`isClosed == true` (not `isClosed is true` or `!isClosed.GetValueOrDefault()`) is the exact fail-open comparison — `false` and `null` both fall through, matching the design's requirement that only a confirmed "yes, closed" blocks anything.

- [ ] **Step 5: Wire the check into `POST /appointments`**

In the same file, find:

```csharp
            var branch = await directoryClient.GetBranchAsync(request.BranchId, tenantContext.TenantId);
            if (branch is null || !branch.IsActive)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["branchId"] = ["Branch not found or not active."] });
            }

            var therapist = await directoryClient.GetTherapistAsync(request.TherapistId, tenantContext.TenantId);
```

Insert this block between them:

```csharp
            var isClosed = await directoryClient.IsBranchClosedAsync(request.BranchId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isClosed == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The branch is closed on this date."] });
            }

```

- [ ] **Step 6: Wire the check into `PUT /appointments/{id}`**

In the same file, find:

```csharp
            if (appointment.Status == AppointmentStatus.Completed)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Appointment is completed", detail: "A completed appointment cannot be rescheduled.");
            }

            var therapist = await directoryClient.GetTherapistAsync(appointment.TherapistId, tenantContext.TenantId);
```

Insert this block between them:

```csharp
            var isClosed = await directoryClient.IsBranchClosedAsync(appointment.BranchId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isClosed == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The branch is closed on this date."] });
            }

```

- [ ] **Step 7: Add the failing tests**

Add to `services/scheduling-api/SchedulingApi.Tests/AvailabilityEndpointTests.cs`:

```csharp
    [Fact]
    public async Task GetAvailability_OnAClosedBranchDate_ReturnsEmptyWindows()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();

        _fixture.DirectoryApiClient.TherapistToReturn = new TherapistInfo
        {
            Id = therapistId,
            Status = RemoteStatus.Active,
            Assignments =
            [
                new TherapistAssignmentInfo
                {
                    BranchId = branchId,
                    TherapyTypeId = therapyTypeId,
                    SessionWindows = [new SessionWindowInfo { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 }]
                }
            ]
        };
        _fixture.DirectoryApiClient.IsBranchClosedToReturn = true;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/availability?branchId={branchId}&therapistId={therapistId}&therapyTypeId={therapyTypeId}&date=2026-10-02", tenantId));
        var body = await response.Content.ReadFromJsonAsync<AvailabilityResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(body!.AvailableWindows);
    }
```

Add to `services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs`:

```csharp
    [Fact]
    public async Task PostAppointment_OnAClosedBranchDate_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        _fixture.DirectoryApiClient.IsBranchClosedToReturn = true;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 10, 2)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostAppointment_WhenHolidayCheckFails_StillSucceeds_FailOpen()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        _fixture.DirectoryApiClient.IsBranchClosedToReturn = null;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 10, 2)
        }));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
```

Add to `services/scheduling-api/SchedulingApi.Tests/AppointmentLifecycleTests.cs`:

```csharp
    [Fact]
    public async Task PutAppointment_RescheduleOntoAClosedBranchDate_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var (appointmentId, _, _, _, _) = await BookAnAppointmentAsync(tenantId);
        _fixture.DirectoryApiClient.IsBranchClosedToReturn = true;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/appointments/{appointmentId}", tenantId, body: new UpdateAppointmentRequest
        {
            WindowName = SchedulingApi.Entities.SessionWindowName.Afternoon,
            AppointmentDate = new DateOnly(2026, 10, 2)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj --filter GetAvailability_OnAClosedBranchDate_ReturnsEmptyWindows`
Expected: FAIL to build — `IsBranchClosedAsync` doesn't exist on the interface/fake yet (this step is written after Steps 1-3 already implement the interface/fake, so in practice this FAIL will already be resolved by the time you reach it if following the steps in order — the intent is: implement Steps 1-6 first per TDD-in-spirit, but since this task's code is fully specified, running the full suite once after Step 7 is sufficient; there's no need for a strict red-green-red cycle here given the brief's code is complete).

- [ ] **Step 9: Run the full test suite and verify everything passes**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 10: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Clients services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs services/scheduling-api/SchedulingApi.Tests/AvailabilityEndpointTests.cs services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs services/scheduling-api/SchedulingApi.Tests/AppointmentLifecycleTests.cs
git commit -m "feat(scheduling-api): respect DirectoryApi holidays in availability, booking, and reschedule"
```

---

## Definition of done for this plan

- [ ] `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj` passes with 0 failures
- [ ] `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj` passes with 0 failures
- [ ] `GET /availability` returns an empty list (not an error) on a closed-branch date
- [ ] `POST /appointments` and `PUT /appointments/{id}` reject a closed-branch date with `ValidationProblem`
- [ ] A `DirectoryApi` holiday-check failure does not block booking (fail-open, verified by a passing test)
- [ ] Every commit from this plan is present in `git log`
