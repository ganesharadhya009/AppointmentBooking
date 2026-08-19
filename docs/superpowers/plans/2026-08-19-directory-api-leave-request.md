# Directory API Leave Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add therapist leave requests to `DirectoryApi`, with an approval workflow, and wire `SchedulingApi`'s availability/booking/reschedule to respect approved leave — structurally a near-exact mirror of the `Holiday` sub-project.

**Architecture:** `LeaveRequest` is a new tenant-scoped entity on `DirectoryApi`, alongside `Holiday`. `SchedulingApi` gains a new `IDirectoryApiClient` method (`IsTherapistOnLeaveAsync`), following the exact same fail-open cross-service pattern already used for `IsBranchClosedAsync`.

**Tech Stack:** .NET 9, EF Core 9.0.19 (already installed, no new packages).

## Global Constraints

- `LeaveRequest` is tenant-scoped: EF Core query filter + `HasIndex(TenantId)`.
- `TherapistId` validated same-tenant on create (must resolve to an existing `Therapist`).
- `EndDate` must be on or after `StartDate` — validated manually in the handler (DataAnnotations doesn't do cross-field comparison without a custom attribute).
- Status lifecycle: `Pending → Approved` or `Pending → Rejected`, one-way — approving/rejecting an already-actioned request returns `409 Conflict`.
- `IsTherapistOnLeaveAsync` checks for an `Approved` leave request only (not `Pending`) — a request awaiting approval must not block booking.
- `SchedulingApi`'s leave check is **fail-open**: any failure (transport error or non-success status) resolves to "not on leave" — same reasoning as `IsBranchClosedAsync`.
- `[Required]` on non-nullable value-typed DTO fields (`StartDate`, `EndDate`) uses the nullable form.
- Every error response is RFC 7807.
- `X-Tenant-Id` forwarded on the new cross-service call.
- Wired into `Appointment`'s three call sites only (`GET /availability`, `POST /appointments`, `PUT /appointments/{id}`) — NOT `DoctorAppointment`'s endpoints, since leave applies to `Therapist`, not `ConsultantDoctor`.

---

### Task 1: DirectoryApi — LeaveRequest entity and approval workflow

**Files:**
- Create: `services/directory-api/DirectoryApi/Entities/LeaveRequest.cs`
- Modify: `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/LeaveRequestDtos.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/LeaveRequestEndpoints.cs`
- Modify: `services/directory-api/DirectoryApi/Program.cs`
- Create: `services/directory-api/DirectoryApi/Migrations/*`
- Test: `services/directory-api/DirectoryApi.Tests/LeaveRequestEndpointsTests.cs`

**Interfaces:**
- Consumes: existing `DirectoryDbContext`, `PagedResult<T>`, `DataAnnotationsValidator`, `ITenantContext`, `Therapist`
- Produces: `POST /leave-requests`, `GET /leave-requests`, `GET /leave-requests/is-on-leave`, `POST /leave-requests/{id}/approve`, `POST /leave-requests/{id}/reject` — the `is-on-leave` endpoint is consumed by Task 2's `SchedulingApi` client

- [ ] **Step 1: Create the entity**

`services/directory-api/DirectoryApi/Entities/LeaveRequest.cs`:

```csharp
namespace DirectoryApi.Entities;

public enum LeaveRequestStatus
{
    Pending,
    Approved,
    Rejected
}

public class LeaveRequest
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid TherapistId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public LeaveRequestStatus Status { get; set; } = LeaveRequestStatus.Pending;
    public string? ApprovedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 2: Register the entity in the DbContext**

Modify `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`. Add this line right after the existing `public DbSet<ConsultantDoctor> ConsultantDoctors => Set<ConsultantDoctor>();`:

```csharp
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<ConsultantDoctor>(d => { ... });` block:

```csharp
        modelBuilder.Entity<LeaveRequest>(l =>
        {
            l.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            l.HasIndex(x => x.TenantId);
            l.HasIndex(x => x.TherapistId);
        });
```

- [ ] **Step 3: Create the DTOs**

`services/directory-api/DirectoryApi/Dtos/LeaveRequestDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateLeaveRequestRequest
{
    [Required]
    public Guid TherapistId { get; set; }

    [Required]
    public DateOnly? StartDate { get; set; }

    [Required]
    public DateOnly? EndDate { get; set; }
}

public class LeaveRequestResponse
{
    public Guid Id { get; set; }
    public Guid TherapistId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public LeaveRequestStatus Status { get; set; }
    public string? ApprovedBy { get; set; }
}

public class IsOnLeaveResponse
{
    public bool IsOnLeave { get; set; }
}
```

- [ ] **Step 4: Implement the endpoints**

`services/directory-api/DirectoryApi/Endpoints/LeaveRequestEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class LeaveRequestEndpoints
{
    public static void MapLeaveRequestEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/leave-requests");

        group.MapGet("", async (int? page, int? pageSize, Guid? therapistId, LeaveRequestStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.LeaveRequests.AsQueryable();

            if (therapistId is not null)
            {
                query = query.Where(l => l.TherapistId == therapistId);
            }

            if (status is not null)
            {
                query = query.Where(l => l.Status == status);
            }

            query = query.OrderByDescending(l => l.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<LeaveRequestResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/is-on-leave", async (Guid therapistId, DateOnly date, DirectoryDbContext db) =>
        {
            var isOnLeave = await db.LeaveRequests.AnyAsync(l =>
                l.TherapistId == therapistId &&
                l.Status == LeaveRequestStatus.Approved &&
                l.StartDate <= date &&
                l.EndDate >= date);
            return Results.Ok(new IsOnLeaveResponse { IsOnLeave = isOnLeave });
        });

        group.MapPost("", async (CreateLeaveRequestRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (request.EndDate!.Value < request.StartDate!.Value)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["endDate"] = ["End date must be on or after the start date."]
                });
            }

            var therapist = await db.Therapists.FirstOrDefaultAsync(t => t.Id == request.TherapistId);
            if (therapist is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["therapistId"] = ["Therapist not found or does not belong to this tenant."]
                });
            }

            var leaveRequest = new LeaveRequest
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                TherapistId = request.TherapistId,
                StartDate = request.StartDate!.Value,
                EndDate = request.EndDate!.Value,
                Status = LeaveRequestStatus.Pending,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.LeaveRequests.Add(leaveRequest);
            await db.SaveChangesAsync();

            return Results.Created($"/leave-requests/{leaveRequest.Id}", ToResponse(leaveRequest));
        });

        group.MapPost("/{id:guid}/approve", async (Guid id, DirectoryDbContext db) =>
        {
            var leaveRequest = await db.LeaveRequests.FirstOrDefaultAsync(l => l.Id == id);
            if (leaveRequest is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Leave request not found");
            }

            if (leaveRequest.Status != LeaveRequestStatus.Pending)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Leave request already actioned", detail: "Only a pending leave request can be approved.");
            }

            leaveRequest.Status = LeaveRequestStatus.Approved;
            leaveRequest.ApprovedBy = "system";
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(leaveRequest));
        });

        group.MapPost("/{id:guid}/reject", async (Guid id, DirectoryDbContext db) =>
        {
            var leaveRequest = await db.LeaveRequests.FirstOrDefaultAsync(l => l.Id == id);
            if (leaveRequest is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Leave request not found");
            }

            if (leaveRequest.Status != LeaveRequestStatus.Pending)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Leave request already actioned", detail: "Only a pending leave request can be rejected.");
            }

            leaveRequest.Status = LeaveRequestStatus.Rejected;
            leaveRequest.ApprovedBy = "system";
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(leaveRequest));
        });
    }

    private static LeaveRequestResponse ToResponse(LeaveRequest leaveRequest) => new()
    {
        Id = leaveRequest.Id,
        TherapistId = leaveRequest.TherapistId,
        StartDate = leaveRequest.StartDate,
        EndDate = leaveRequest.EndDate,
        Status = leaveRequest.Status,
        ApprovedBy = leaveRequest.ApprovedBy
    };
}
```

- [ ] **Step 5: Map the endpoints in `Program.cs`**

Add this line right after the existing `app.MapConsultantDoctorEndpoints();` line in `services/directory-api/DirectoryApi/Program.cs`:

```csharp
app.MapLeaveRequestEndpoints();
```

- [ ] **Step 6: Write the tests**

`services/directory-api/DirectoryApi.Tests/LeaveRequestEndpointsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class LeaveRequestEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public LeaveRequestEndpointsTests(LocalDbTestFixture fixture)
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

    private async Task<Guid> CreateTherapistAsync(Guid tenantId)
    {
        var branchResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/branches", tenantId, new CreateBranchRequest
        {
            Name = "Test Branch For Leave",
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
        var branch = await branchResponse.Content.ReadFromJsonAsync<BranchResponse>();

        var therapyTypeResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapy-types", tenantId, new CreateTherapyTypeRequest
        {
            Name = "Test Therapy For Leave"
        }));
        var therapyType = await therapyTypeResponse.Content.ReadFromJsonAsync<TherapyTypeResponse>();

        var therapistResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
        {
            Name = "Test Therapist For Leave",
            MobileNumber = "7777777777",
            Email = "leave-therapist@example.com",
            LicenseNumber = "LIC-LEAVE",
            Designation = "Therapist",
            Assignments =
            [
                new AssignmentDto
                {
                    BranchId = branch!.Id,
                    TherapyTypeId = therapyType!.Id,
                    JoiningDate = new DateOnly(2026, 1, 1),
                    WeeklyDayOff = DayOfWeek.Sunday,
                    SessionWindows = [new SessionWindowDto { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 }]
                }
            ]
        }));
        var therapist = await therapistResponse.Content.ReadFromJsonAsync<TherapistResponse>();
        return therapist!.Id;
    }

    [Fact]
    public async Task PostLeaveRequest_ThenGetIsOnLeave_ReturnsFalseUntilApproved()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);

        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(LeaveRequestStatus.Pending, created!.Status);

        var isOnLeaveResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/leave-requests/is-on-leave?therapistId={therapistId}&date=2026-10-03", tenantId));
        var isOnLeaveBody = await isOnLeaveResponse.Content.ReadFromJsonAsync<IsOnLeaveResponse>();

        Assert.False(isOnLeaveBody!.IsOnLeave);
    }

    [Fact]
    public async Task ApproveLeaveRequest_ThenGetIsOnLeave_ReturnsTrueWithinRange()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();

        var approveResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/leave-requests/{created!.Id}/approve", tenantId));
        Assert.Equal(HttpStatusCode.OK, approveResponse.StatusCode);

        var isOnLeaveResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/leave-requests/is-on-leave?therapistId={therapistId}&date=2026-10-03", tenantId));
        var isOnLeaveBody = await isOnLeaveResponse.Content.ReadFromJsonAsync<IsOnLeaveResponse>();

        Assert.True(isOnLeaveBody!.IsOnLeave);

        var outsideRangeResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/leave-requests/is-on-leave?therapistId={therapistId}&date=2026-10-10", tenantId));
        var outsideRangeBody = await outsideRangeResponse.Content.ReadFromJsonAsync<IsOnLeaveResponse>();

        Assert.False(outsideRangeBody!.IsOnLeave);
    }

    [Fact]
    public async Task ApproveLeaveRequest_CalledTwice_SecondCallReturns409()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Post, $"/leave-requests/{created!.Id}/approve", tenantId));

        var secondApprove = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/leave-requests/{created.Id}/approve", tenantId));

        Assert.Equal(HttpStatusCode.Conflict, secondApprove.StatusCode);
    }

    [Fact]
    public async Task PostLeaveRequest_WithEndDateBeforeStartDate_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 5),
            EndDate = new DateOnly(2026, 10, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostLeaveRequest_WithCrossTenantTherapist_ReturnsValidationProblem()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantA);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantB, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RejectLeaveRequest_SetsStatusToRejected()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();

        var rejectResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/leave-requests/{created!.Id}/reject", tenantId));
        var rejectBody = await rejectResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();

        Assert.Equal(HttpStatusCode.OK, rejectResponse.StatusCode);
        Assert.Equal(LeaveRequestStatus.Rejected, rejectBody!.Status);
    }
}
```

- [ ] **Step 7: Generate the migration**

```bash
cd services/directory-api/DirectoryApi
dotnet ef migrations add AddLeaveRequest --output-dir Migrations
cd ../../..
```

- [ ] **Step 8: Run the tests and verify they pass**

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 9: Commit**

```bash
git add services/directory-api/DirectoryApi/Entities/LeaveRequest.cs services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs services/directory-api/DirectoryApi/Dtos/LeaveRequestDtos.cs services/directory-api/DirectoryApi/Endpoints/LeaveRequestEndpoints.cs services/directory-api/DirectoryApi/Program.cs services/directory-api/DirectoryApi/Migrations services/directory-api/DirectoryApi.Tests/LeaveRequestEndpointsTests.cs
git commit -m "feat(directory-api): add LeaveRequest with approval workflow and is-on-leave check"
```

---

### Task 2: SchedulingApi — respect approved leave in availability, booking, and reschedule

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/AvailabilityEndpointTests.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/AppointmentLifecycleTests.cs`

**Interfaces:**
- Consumes: `IDirectoryApiClient` (existing), Task 1's `GET /leave-requests/is-on-leave`
- Produces: `IDirectoryApiClient.IsTherapistOnLeaveAsync(Guid therapistId, DateOnly date, Guid tenantId, CancellationToken)`

- [ ] **Step 1: Add the new client method**

Modify `services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`. Add this class right after the existing `IsClosedResponse` class:

```csharp
public class IsOnLeaveResponse
{
    public bool IsOnLeave { get; set; }
}
```

Add this method to the `IDirectoryApiClient` interface, right after the existing `IsBranchClosedAsync` signature:

```csharp
    Task<bool?> IsTherapistOnLeaveAsync(Guid therapistId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default);
```

- [ ] **Step 2: Implement it on `DirectoryApiClient`**

Add this method to `services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`, right after the existing `IsBranchClosedAsync` method:

```csharp
    public async Task<bool?> IsTherapistOnLeaveAsync(Guid therapistId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/leave-requests/is-on-leave?therapistId={therapistId}&date={date:yyyy-MM-dd}");
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
        var result = await response.Content.ReadFromJsonAsync<IsOnLeaveResponse>(JsonOptions, cancellationToken);
        return result?.IsOnLeave;
    }
```

Same reasoning as `IsBranchClosedAsync` for the try/catch — this method's fail-open contract requires distinguishing "call failed" from "call succeeded."

- [ ] **Step 3: Update the fake client**

Modify `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`. Add this property right after the existing `IsBranchClosedToReturn` property:

```csharp
    public bool? IsTherapistOnLeaveToReturn { get; set; }
```

Add this method right after the existing `IsBranchClosedAsync` method:

```csharp
    public Task<bool?> IsTherapistOnLeaveAsync(Guid therapistId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(IsTherapistOnLeaveToReturn);
```

`IsTherapistOnLeaveToReturn` defaults to `null`, so no existing test's behavior changes.

- [ ] **Step 4: Wire the check into `GET /availability`**

Modify `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`. Find the block added by the `Holiday` sub-project inside the `/availability` handler:

```csharp
            var isClosed = await directoryClient.IsBranchClosedAsync(branchId, date, tenantContext.TenantId);
            if (isClosed == true)
            {
                return Results.Ok(new AvailabilityResponse { AvailableWindows = [] });
            }

```

Insert this block right after it, still before `var existingAppointments = ...`:

```csharp
            var isOnLeave = await directoryClient.IsTherapistOnLeaveAsync(therapistId, date, tenantContext.TenantId);
            if (isOnLeave == true)
            {
                return Results.Ok(new AvailabilityResponse { AvailableWindows = [] });
            }

```

- [ ] **Step 5: Wire the check into `POST /appointments`**

In the same file, find the existing holiday check inside `POST /appointments`:

```csharp
            var isClosed = await directoryClient.IsBranchClosedAsync(request.BranchId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isClosed == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The branch is closed on this date."] });
            }

```

Insert this block right after it, still before `var therapist = await directoryClient.GetTherapistAsync(...)`:

```csharp
            var isOnLeave = await directoryClient.IsTherapistOnLeaveAsync(request.TherapistId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isOnLeave == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The therapist is on approved leave on this date."] });
            }

```

- [ ] **Step 6: Wire the check into `PUT /appointments/{id}`**

In the same file, find the existing holiday check inside `PUT /appointments/{id}`:

```csharp
            var isClosed = await directoryClient.IsBranchClosedAsync(appointment.BranchId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isClosed == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The branch is closed on this date."] });
            }

```

Insert this block right after it, still before `var therapist = await directoryClient.GetTherapistAsync(appointment.TherapistId, ...)`:

```csharp
            var isOnLeave = await directoryClient.IsTherapistOnLeaveAsync(appointment.TherapistId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isOnLeave == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The therapist is on approved leave on this date."] });
            }

```

- [ ] **Step 7: Add the tests**

Add to `services/scheduling-api/SchedulingApi.Tests/AvailabilityEndpointTests.cs`:

```csharp
    [Fact]
    public async Task GetAvailability_WhenTherapistOnLeave_ReturnsEmptyWindows()
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
        _fixture.DirectoryApiClient.IsTherapistOnLeaveToReturn = true;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/availability?branchId={branchId}&therapistId={therapistId}&therapyTypeId={therapyTypeId}&date=2026-10-03", tenantId));
        var body = await response.Content.ReadFromJsonAsync<AvailabilityResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(body!.AvailableWindows);
    }
```

Add to `services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs`:

```csharp
    [Fact]
    public async Task PostAppointment_WhenTherapistOnLeave_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        _fixture.DirectoryApiClient.IsTherapistOnLeaveToReturn = true;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 10, 3)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
```

Add to `services/scheduling-api/SchedulingApi.Tests/AppointmentLifecycleTests.cs`:

```csharp
    [Fact]
    public async Task PutAppointment_RescheduleOntoATherapistsLeaveDate_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var (appointmentId, _, _, _, _) = await BookAnAppointmentAsync(tenantId);
        _fixture.DirectoryApiClient.IsTherapistOnLeaveToReturn = true;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/appointments/{appointmentId}", tenantId, body: new UpdateAppointmentRequest
        {
            WindowName = SchedulingApi.Entities.SessionWindowName.Afternoon,
            AppointmentDate = new DateOnly(2026, 10, 3)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
```

- [ ] **Step 8: Run the full test suite and verify everything passes**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 9: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Clients services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs services/scheduling-api/SchedulingApi.Tests/AvailabilityEndpointTests.cs services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs services/scheduling-api/SchedulingApi.Tests/AppointmentLifecycleTests.cs
git commit -m "feat(scheduling-api): respect DirectoryApi approved leave requests in availability, booking, and reschedule"
```

---

## Definition of done for this plan

- [ ] `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj` passes with 0 failures
- [ ] `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj` passes with 0 failures
- [ ] `is-on-leave` returns `true` only for `Approved` requests within the date range, `false` for `Pending`/`Rejected` or out-of-range dates
- [ ] `GET /availability` returns an empty list on a leave date; `POST /appointments`/`PUT /appointments/{id}` reject a leave date with `ValidationProblem`
- [ ] A `DirectoryApi` leave-check failure does not block booking (fail-open, verified by a passing test — reuse the existing `PostAppointment_WhenHolidayCheckFails_StillSucceeds_FailOpen` pattern's proof if a dedicated leave-specific fail-open test isn't separately required)
- [ ] Every commit from this plan is present in `git log`
