# Scheduling API Refund Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a refund-approval workflow (`RefundRequest`) to `SchedulingApi` — an approval-workflow entity only, not money movement (the actual refund credit happens once `BillingApi` exists in Phase 3).

**Architecture:** `RefundRequest` is a new tenant-scoped entity in the existing `SchedulingDbContext`, referencing either a therapist `Appointment` or a `DoctorAppointment` via a type discriminator, since both entities live in this same service.

**Tech Stack:** .NET 9, EF Core 9.0.19 (already installed, no new packages).

## Global Constraints

- **Unit/integration test-writing is deferred to a later consolidated pass** (explicit user instruction, 2026-08-19, tracked as a 🔴 item in `DEFERRED-AND-TODO.md`) — this plan has no test-writing steps. Each task's acceptance is: builds clean, and the *existing* test suite still passes unchanged (a regression check, not new test authoring).
- `RefundRequest` is tenant-scoped: EF Core query filter + `HasIndex(TenantId)`.
- `AppointmentId` is validated against `Appointment` or `DoctorAppointment` depending on `AppointmentType` — both same-service, same-tenant (via the existing query filters on those entities).
- Status lifecycle: `Pending → Approved` or `Pending → Rejected`, one-way — acting on an already-actioned request returns `409 Conflict`.
- Created explicitly by staff (`POST /refund-requests`), not auto-triggered by `DELETE /appointments/{id}`/`DELETE /doctor-appointments/{id}` — keeps the booking endpoints' contract unchanged.
- `[Required]` on non-nullable value-typed DTO fields (`AppointmentType`, `Amount`) uses the nullable form.
- Every error response is RFC 7807.

---

### Task 1: RefundRequest entity and approval workflow

**Files:**
- Create: `services/scheduling-api/SchedulingApi/Entities/RefundRequest.cs`
- Modify: `services/scheduling-api/SchedulingApi/Data/SchedulingDbContext.cs`
- Create: `services/scheduling-api/SchedulingApi/Dtos/RefundRequestDtos.cs`
- Create: `services/scheduling-api/SchedulingApi/Endpoints/RefundRequestEndpoints.cs`
- Modify: `services/scheduling-api/SchedulingApi/Program.cs`
- Create: `services/scheduling-api/SchedulingApi/Migrations/*`

**Interfaces:**
- Consumes: existing `SchedulingDbContext`, `PagedResult<T>`, `DataAnnotationsValidator`, `ITenantContext`, `Appointment`, `DoctorAppointment`
- Produces: `POST /refund-requests`, `GET /refund-requests`, `POST /refund-requests/{id}/approve`, `POST /refund-requests/{id}/reject`

- [ ] **Step 1: Create the entity**

`services/scheduling-api/SchedulingApi/Entities/RefundRequest.cs`:

```csharp
namespace SchedulingApi.Entities;

public enum RefundRequestAppointmentType
{
    TherapistAppointment,
    DoctorAppointment
}

public enum RefundRequestStatus
{
    Pending,
    Approved,
    Rejected
}

public class RefundRequest
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public RefundRequestAppointmentType AppointmentType { get; set; }
    public Guid AppointmentId { get; set; }
    public decimal Amount { get; set; }
    public RefundRequestStatus Status { get; set; } = RefundRequestStatus.Pending;
    public string? ApprovedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 2: Register the entity in the DbContext**

Modify `services/scheduling-api/SchedulingApi/Data/SchedulingDbContext.cs`. Add this line right after the existing `public DbSet<DoctorAppointment> DoctorAppointments => Set<DoctorAppointment>();`:

```csharp
    public DbSet<RefundRequest> RefundRequests => Set<RefundRequest>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<DoctorAppointment>(d => { ... });` block:

```csharp
        modelBuilder.Entity<RefundRequest>(r =>
        {
            r.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            r.HasIndex(x => x.TenantId);
            r.Property(x => x.Amount).HasColumnType("decimal(10,2)");
            r.Property(x => x.ApprovedBy).HasMaxLength(200);
        });
```

- [ ] **Step 3: Create the DTOs**

`services/scheduling-api/SchedulingApi/Dtos/RefundRequestDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using SchedulingApi.Entities;

namespace SchedulingApi.Dtos;

public class CreateRefundRequestRequest
{
    [Required]
    public RefundRequestAppointmentType? AppointmentType { get; set; }

    [Required]
    public Guid AppointmentId { get; set; }

    [Required]
    public decimal? Amount { get; set; }
}

public class RefundRequestResponse
{
    public Guid Id { get; set; }
    public RefundRequestAppointmentType AppointmentType { get; set; }
    public Guid AppointmentId { get; set; }
    public decimal Amount { get; set; }
    public RefundRequestStatus Status { get; set; }
    public string? ApprovedBy { get; set; }
}
```

- [ ] **Step 4: Implement the endpoints**

`services/scheduling-api/SchedulingApi/Endpoints/RefundRequestEndpoints.cs`:

```csharp
using SchedulingApi.Common;
using SchedulingApi.Data;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Tenancy;
using SchedulingApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Endpoints;

public static class RefundRequestEndpoints
{
    public static void MapRefundRequestEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/refund-requests");

        group.MapGet("", async (int? page, int? pageSize, RefundRequestStatus? status, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.RefundRequests.AsQueryable();
            if (status is not null)
            {
                query = query.Where(r => r.Status == status);
            }
            query = query.OrderByDescending(r => r.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<RefundRequestResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapPost("", async (CreateRefundRequestRequest request, SchedulingDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (request.AppointmentType == RefundRequestAppointmentType.TherapistAppointment)
            {
                var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == request.AppointmentId);
                if (appointment is null)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentId"] = ["Appointment not found or does not belong to this tenant."] });
                }
            }
            else
            {
                var doctorAppointment = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.Id == request.AppointmentId);
                if (doctorAppointment is null)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentId"] = ["Doctor appointment not found or does not belong to this tenant."] });
                }
            }

            var refundRequest = new RefundRequest
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                AppointmentType = request.AppointmentType!.Value,
                AppointmentId = request.AppointmentId,
                Amount = request.Amount!.Value,
                Status = RefundRequestStatus.Pending,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.RefundRequests.Add(refundRequest);
            await db.SaveChangesAsync();

            return Results.Created($"/refund-requests/{refundRequest.Id}", ToResponse(refundRequest));
        });

        group.MapPost("/{id:guid}/approve", async (Guid id, SchedulingDbContext db) =>
        {
            var refundRequest = await db.RefundRequests.FirstOrDefaultAsync(r => r.Id == id);
            if (refundRequest is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Refund request not found");
            }

            if (refundRequest.Status != RefundRequestStatus.Pending)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Refund request already actioned", detail: "Only a pending refund request can be approved.");
            }

            refundRequest.Status = RefundRequestStatus.Approved;
            refundRequest.ApprovedBy = "system";
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(refundRequest));
        });

        group.MapPost("/{id:guid}/reject", async (Guid id, SchedulingDbContext db) =>
        {
            var refundRequest = await db.RefundRequests.FirstOrDefaultAsync(r => r.Id == id);
            if (refundRequest is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Refund request not found");
            }

            if (refundRequest.Status != RefundRequestStatus.Pending)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Refund request already actioned", detail: "Only a pending refund request can be rejected.");
            }

            refundRequest.Status = RefundRequestStatus.Rejected;
            refundRequest.ApprovedBy = "system";
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(refundRequest));
        });
    }

    private static RefundRequestResponse ToResponse(RefundRequest refundRequest) => new()
    {
        Id = refundRequest.Id,
        AppointmentType = refundRequest.AppointmentType,
        AppointmentId = refundRequest.AppointmentId,
        Amount = refundRequest.Amount,
        Status = refundRequest.Status,
        ApprovedBy = refundRequest.ApprovedBy
    };
}
```

- [ ] **Step 5: Map the endpoints in `Program.cs`**

Add this line right after the existing `app.MapDoctorAppointmentEndpoints();` line in `services/scheduling-api/SchedulingApi/Program.cs`:

```csharp
app.MapRefundRequestEndpoints();
```

- [ ] **Step 6: Generate the migration**

```bash
cd services/scheduling-api/SchedulingApi
dotnet ef migrations add AddRefundRequest --output-dir Migrations
cd ../../..
```

- [ ] **Step 7: Build and run the existing test suite as a regression check**

Run: `dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: the existing test count, unchanged, 0 failures — this confirms the new code didn't break anything already covered. This is a regression check, not new test-writing — do not add any `[Fact]` methods for `RefundRequest` itself.

- [ ] **Step 8: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Entities/RefundRequest.cs services/scheduling-api/SchedulingApi/Data/SchedulingDbContext.cs services/scheduling-api/SchedulingApi/Dtos/RefundRequestDtos.cs services/scheduling-api/SchedulingApi/Endpoints/RefundRequestEndpoints.cs services/scheduling-api/SchedulingApi/Program.cs services/scheduling-api/SchedulingApi/Migrations
git commit -m "feat(scheduling-api): add RefundRequest approval workflow (tests deferred to later pass)"
```

---

## Definition of done for this plan

- [ ] `dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj` succeeds with 0 errors
- [ ] `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj` — existing suite passes unchanged (regression check only)
- [ ] `POST /refund-requests` rejects an `AppointmentId` that doesn't resolve for the given `AppointmentType`, same-tenant
- [ ] Approve/reject are one-way from `Pending`, and re-acting on an already-actioned request returns `409`
- [ ] The commit from this plan is present in `git log`
- [ ] **Test coverage for this sub-project remains outstanding** — tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier for the later consolidated test-writing pass
