# Scheduling API Doctor Appointment Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add doctor-consultation booking (`DoctorAppointment`) to `SchedulingApi` — a second, parallel booking flow alongside the existing therapist `Appointment`, validated against `DirectoryApi`'s new Consultant catalog.

**Architecture:** `DoctorAppointment` is a new, distinct entity in the existing `SchedulingDbContext` — not merged into `Appointment`, since doctor consultations have no session-window shape. `IDirectoryApiClient` gains one new method (`GetConsultantDoctorAsync`), following the exact pattern already used for `GetBranchAsync`/`GetTherapistAsync`/`IsBranchClosedAsync`.

**Tech Stack:** .NET 9, EF Core 9.0.19 (already installed, no new packages).

## Global Constraints

- `DoctorAppointment` is tenant-scoped: EF Core query filter + `HasIndex(TenantId)` — the established convention.
- `POST /doctor-appointments` requires an `Idempotency-Key` header (max 200 chars), same contract as `POST /appointments`: a `(TenantId, IdempotencyKey)` unique index plus a narrow `DbUpdateException` unique-violation catch (`SqlException { Number: 2601 or 2627 }` only — never a bare `catch (DbUpdateException)`, per the lesson learned in the original `Appointment` sub-project's final review) that replays the original booking on a race.
- One `DoctorAppointment` per `ConsultantDoctorId` + `AppointmentDate` + `AppointmentTime` (non-cancelled) — enforced at both the app level (`AnyAsync` pre-check) AND the DB level (a filtered unique index excluding `Cancelled` rows, `HasFilter("[Status] <> 2")`) from day one — applying the original `Appointment` sub-project's final-review lesson proactively, not as a follow-up fix.
- `ConsultantClinicId`/`ConsultantServiceId`/`ConsultationFee` are denormalized onto `DoctorAppointment` at booking time (and re-captured on reschedule) — a later change to the doctor's clinic/service/fee shouldn't retroactively alter an already-booked appointment.
- `DoctorAppointment.Status` reuses the existing `SchedulingApi.Entities.AppointmentStatus` enum (Planned/Completed/Cancelled) — this is a deliberate reuse, not a new duplicate enum, since `DoctorAppointment` and `Appointment` genuinely share the identical status lifecycle concept (unlike the Consultant catalog's `ConsultantStatus`, which was a *new* shared enum across three DirectoryApi entities that don't have an existing status type to reuse).
- `[Required]` on non-nullable value-typed DTO fields (`AppointmentDate`, `AppointmentTime`) uses the nullable form (`DateOnly?`, `TimeOnly?`) — the established `[Required]`-on-value-type no-op lesson.
- No availability/windows endpoint — booking conflict is checked directly, since doctors have no session-window schedule concept in this platform's data model.
- Every error response is RFC 7807 via `Results.Problem(...)`/`Results.ValidationProblem(...)`.
- `X-Tenant-Id` forwarded on the new cross-service call, matching every other cross-service call in the codebase.

---

### Task 1: Cross-service client — GetConsultantDoctorAsync

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`

**Interfaces:**
- Consumes: existing `IDirectoryApiClient`, `DirectoryApiClient`, `JsonOptions` pattern
- Produces: `RemoteConsultantStatus` enum, `ConsultantDoctorInfo`, `IDirectoryApiClient.GetConsultantDoctorAsync(Guid consultantDoctorId, Guid tenantId, CancellationToken)` — consumed by Task 2/3's `DoctorAppointment` endpoints

- [ ] **Step 1: Add the new DTOs and interface method**

Modify `services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`. Add this block right after the existing `IsClosedResponse` class:

```csharp
public enum RemoteConsultantStatus
{
    Active,
    Inactive
}

public class ConsultantDoctorInfo
{
    public Guid Id { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public Guid ConsultantClinicId { get; set; }
    public decimal ConsultationFee { get; set; }
    public RemoteConsultantStatus Status { get; set; }
}
```

`RemoteConsultantStatus` is a NEW, separate enum from `RemoteStatus` — do not reuse `RemoteStatus` even though its first two members (`Active`, `Inactive`) share the same ordinals. `RemoteStatus` represents `Therapist`/`Branch`'s three-tier concept (Active/Inactive/Deleted); `DirectoryApi`'s `ConsultantStatus` is genuinely two-tier. Reusing `RemoteStatus` here would work by coincidence today but silently break if either enum's member set ever changes independently.

Add this line to the `IDirectoryApiClient` interface, right after the existing `IsBranchClosedAsync` signature:

```csharp
    Task<ConsultantDoctorInfo?> GetConsultantDoctorAsync(Guid consultantDoctorId, Guid tenantId, CancellationToken cancellationToken = default);
```

- [ ] **Step 2: Implement it on `DirectoryApiClient`**

Add this method to `services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`, right after the existing `IsBranchClosedAsync` method:

```csharp
    public async Task<ConsultantDoctorInfo?> GetConsultantDoctorAsync(Guid consultantDoctorId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/consultant-doctors/{consultantDoctorId}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<ConsultantDoctorInfo>(JsonOptions, cancellationToken)
            : null;
    }
```

- [ ] **Step 3: Update the fake client**

Modify `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`. Add this property right after the existing `IsBranchClosedToReturn` property:

```csharp
    public ConsultantDoctorInfo? ConsultantDoctorToReturn { get; set; }
```

Add this method right after the existing `IsBranchClosedAsync` method:

```csharp
    public Task<ConsultantDoctorInfo?> GetConsultantDoctorAsync(Guid consultantDoctorId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(ConsultantDoctorToReturn);
```

`ConsultantDoctorToReturn` defaults to `null`, so no existing test's behavior changes.

- [ ] **Step 4: Run the full test suite and verify everything still passes**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total. This step should only build/pass unchanged, since nothing yet calls the new method.

- [ ] **Step 5: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Clients services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs
git commit -m "feat(scheduling-api): add IDirectoryApiClient.GetConsultantDoctorAsync"
```

---

### Task 2: DoctorAppointment entity + booking (POST/GET/list)

**Files:**
- Create: `services/scheduling-api/SchedulingApi/Entities/DoctorAppointment.cs`
- Modify: `services/scheduling-api/SchedulingApi/Data/SchedulingDbContext.cs`
- Create: `services/scheduling-api/SchedulingApi/Dtos/DoctorAppointmentDtos.cs`
- Create: `services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`
- Modify: `services/scheduling-api/SchedulingApi/Program.cs`
- Create: `services/scheduling-api/SchedulingApi/Migrations/*`
- Test: `services/scheduling-api/SchedulingApi.Tests/DoctorAppointmentBookingTests.cs`

**Interfaces:**
- Consumes: `RemoteConsultantStatus`, `ConsultantDoctorInfo`, `IDirectoryApiClient.GetConsultantDoctorAsync` (Task 1); existing `IClientRecordsApiClient`, `RemoteClientStatus`, `PagedResult<T>`, `DataAnnotationsValidator`, `ITenantContext`, `AppointmentStatus`
- Produces: `DoctorAppointment` entity, `POST /doctor-appointments`, `GET /doctor-appointments`, `GET /doctor-appointments/{id}` — the entity and `ToResponse` helper pattern are consumed by Task 3's `PUT`/`DELETE`

- [ ] **Step 1: Create the entity**

`services/scheduling-api/SchedulingApi/Entities/DoctorAppointment.cs`:

```csharp
namespace SchedulingApi.Entities;

public class DoctorAppointment
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ConsultantDoctorId { get; set; }
    public Guid ConsultantClinicId { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public Guid ChildId { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly AppointmentTime { get; set; }
    public decimal ConsultationFee { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Planned;
    public required string IdempotencyKey { get; set; }
    public required string BookedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

`AppointmentStatus` is the existing enum already declared in `Entities/Appointment.cs` (same namespace, no new import needed) — reused deliberately, per the Global Constraints.

- [ ] **Step 2: Register the entity in the DbContext**

Modify `services/scheduling-api/SchedulingApi/Data/SchedulingDbContext.cs`. Add this line right after the existing `public DbSet<Appointment> Appointments => Set<Appointment>();`:

```csharp
    public DbSet<DoctorAppointment> DoctorAppointments => Set<DoctorAppointment>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<Appointment>(a => { ... });` block:

```csharp
        modelBuilder.Entity<DoctorAppointment>(d =>
        {
            d.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            d.HasIndex(x => x.TenantId);
            d.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
            d.HasIndex(x => new { x.TenantId, x.ConsultantDoctorId, x.AppointmentDate, x.AppointmentTime }).IsUnique().HasFilter("[Status] <> 2");
            d.Property(x => x.ConsultationFee).HasColumnType("decimal(10,2)");
            d.Property(x => x.IdempotencyKey).HasMaxLength(200);
            d.Property(x => x.BookedBy).HasMaxLength(200);
        });
```

The filtered unique index's `[Status] <> 2` corresponds to `AppointmentStatus.Cancelled`'s ordinal (`Planned`=0, `Completed`=1, `Cancelled`=2) — identical reasoning to `Appointment`'s own filtered index. This is the exact index `Appointment` only got in a post-final-review fix wave; `DoctorAppointment` gets it from day one.

- [ ] **Step 3: Create the DTOs**

`services/scheduling-api/SchedulingApi/Dtos/DoctorAppointmentDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using SchedulingApi.Entities;

namespace SchedulingApi.Dtos;

public class CreateDoctorAppointmentRequest
{
    [Required]
    public Guid ConsultantDoctorId { get; set; }

    [Required]
    public Guid ChildId { get; set; }

    [Required]
    public DateOnly? AppointmentDate { get; set; }

    [Required]
    public TimeOnly? AppointmentTime { get; set; }
}

public class UpdateDoctorAppointmentRequest
{
    [Required]
    public DateOnly? AppointmentDate { get; set; }

    [Required]
    public TimeOnly? AppointmentTime { get; set; }
}

public class DoctorAppointmentResponse
{
    public Guid Id { get; set; }
    public Guid ConsultantDoctorId { get; set; }
    public Guid ConsultantClinicId { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public Guid ChildId { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly AppointmentTime { get; set; }
    public decimal ConsultationFee { get; set; }
    public AppointmentStatus Status { get; set; }
}
```

- [ ] **Step 4: Implement the entity's endpoints group, POST, and GETs**

`services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`:

```csharp
using SchedulingApi.Clients;
using SchedulingApi.Common;
using SchedulingApi.Data;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Tenancy;
using SchedulingApi.Validation;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Endpoints;

public static class DoctorAppointmentEndpoints
{
    public static void MapDoctorAppointmentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/doctor-appointments");

        group.MapGet("", async (int? page, int? pageSize, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.DoctorAppointments.OrderByDescending(a => a.AppointmentDate).ThenByDescending(a => a.CreatedAt).ThenBy(a => a.Id);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<DoctorAppointmentResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, SchedulingDbContext db) =>
        {
            var appointment = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.Id == id);
            return appointment is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Doctor appointment not found")
                : Results.Ok(ToResponse(appointment));
        });

        group.MapPost("", async (CreateDoctorAppointmentRequest request, HttpRequest httpRequest, SchedulingDbContext db, IDirectoryApiClient directoryClient, IClientRecordsApiClient clientRecordsClient, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (!httpRequest.Headers.TryGetValue("Idempotency-Key", out var idempotencyKeyValues) || string.IsNullOrWhiteSpace(idempotencyKeyValues.ToString()))
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Missing Idempotency-Key header", detail: "POST /doctor-appointments requires an Idempotency-Key header.");
            }
            var idempotencyKey = idempotencyKeyValues.ToString();
            if (idempotencyKey!.Length > 200)
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Idempotency-Key header is too long", detail: "Idempotency-Key must be 200 characters or fewer.");
            }

            var existing = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.IdempotencyKey == idempotencyKey);
            if (existing is not null)
            {
                return Results.Created($"/doctor-appointments/{existing.Id}", ToResponse(existing));
            }

            var doctor = await directoryClient.GetConsultantDoctorAsync(request.ConsultantDoctorId, tenantContext.TenantId);
            if (doctor is null || doctor.Status != RemoteConsultantStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["consultantDoctorId"] = ["Consultant doctor not found or not active."] });
            }

            var child = await clientRecordsClient.GetChildAsync(request.ChildId, tenantContext.TenantId);
            if (child is null || child.Status != RemoteClientStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["childId"] = ["Child not found or not active."] });
            }

            var conflict = await db.DoctorAppointments.AnyAsync(a =>
                a.ConsultantDoctorId == request.ConsultantDoctorId &&
                a.AppointmentDate == request.AppointmentDate!.Value &&
                a.AppointmentTime == request.AppointmentTime!.Value &&
                a.Status != AppointmentStatus.Cancelled);
            if (conflict)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This doctor already has an appointment at this date and time.");
            }

            var appointment = new DoctorAppointment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ConsultantDoctorId = request.ConsultantDoctorId,
                ConsultantClinicId = doctor.ConsultantClinicId,
                ConsultantServiceId = doctor.ConsultantServiceId,
                ChildId = request.ChildId,
                AppointmentDate = request.AppointmentDate!.Value,
                AppointmentTime = request.AppointmentTime!.Value,
                ConsultationFee = doctor.ConsultationFee,
                Status = AppointmentStatus.Planned,
                IdempotencyKey = idempotencyKey!,
                BookedBy = "system",
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.DoctorAppointments.Add(appointment);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                db.ChangeTracker.Clear();
                var raced = await db.DoctorAppointments.AsNoTracking().FirstOrDefaultAsync(a => a.IdempotencyKey == idempotencyKey);
                if (raced is not null)
                {
                    return Results.Created($"/doctor-appointments/{raced.Id}", ToResponse(raced));
                }
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This doctor already has an appointment at this date and time.");
            }

            return Results.Created($"/doctor-appointments/{appointment.Id}", ToResponse(appointment));
        });
    }

    private static bool IsUniqueViolation(Microsoft.EntityFrameworkCore.DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };

    private static DoctorAppointmentResponse ToResponse(DoctorAppointment appointment) => new()
    {
        Id = appointment.Id,
        ConsultantDoctorId = appointment.ConsultantDoctorId,
        ConsultantClinicId = appointment.ConsultantClinicId,
        ConsultantServiceId = appointment.ConsultantServiceId,
        ChildId = appointment.ChildId,
        AppointmentDate = appointment.AppointmentDate,
        AppointmentTime = appointment.AppointmentTime,
        ConsultationFee = appointment.ConsultationFee,
        Status = appointment.Status
    };
}
```

Task 3 adds `PUT`/`DELETE` inside the same `MapDoctorAppointmentEndpoints` method, right after this `MapPost` block — leave the method's closing brace positioned so Task 3 can insert before it (i.e., after writing this step, the file's `MapDoctorAppointmentEndpoints` method body ends right after `group.MapPost(...)`'s closing `});`, followed by the method's own closing `}`).

- [ ] **Step 5: Map the endpoints in `Program.cs`**

Add this line right after the existing `app.MapAppointmentEndpoints();` line in `services/scheduling-api/SchedulingApi/Program.cs`:

```csharp
app.MapDoctorAppointmentEndpoints();
```

- [ ] **Step 6: Write the tests**

`services/scheduling-api/SchedulingApi.Tests/DoctorAppointmentBookingTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using SchedulingApi.Clients;
using SchedulingApi.Common;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Tests.Fixtures;
using Xunit;

namespace SchedulingApi.Tests;

public class DoctorAppointmentBookingTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;
    private readonly HttpClient _client;

    public DoctorAppointmentBookingTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.CreateClient();
    }

    private HttpRequestMessage WithTenant(HttpMethod method, string url, Guid tenantId, string? idempotencyKey = null, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        if (idempotencyKey is not null)
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return request;
    }

    private void SetUpValidReferences(Guid doctorId, Guid childId, Guid? clinicId = null, Guid? serviceId = null)
    {
        _fixture.DirectoryApiClient.ConsultantDoctorToReturn = new ConsultantDoctorInfo
        {
            Id = doctorId,
            ConsultantClinicId = clinicId ?? Guid.NewGuid(),
            ConsultantServiceId = serviceId ?? Guid.NewGuid(),
            ConsultationFee = 800,
            Status = RemoteConsultantStatus.Active
        };
        _fixture.ClientRecordsApiClient.ChildToReturn = new ChildInfo { Id = childId, Status = RemoteClientStatus.Active };
    }

    [Fact]
    public async Task PostDoctorAppointment_WithValidReferences_CreatesAppointment()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var body = await response.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(AppointmentStatus.Planned, body!.Status);
        Assert.Equal(800, body.ConsultationFee);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithoutIdempotencyKey_Returns400()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, idempotencyKey: null, body: new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = Guid.NewGuid(),
            ChildId = Guid.NewGuid(),
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithSameIdempotencyKeyTwice_ReturnsTheSameAppointmentBothTimes()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var idempotencyKey = Guid.NewGuid().ToString();
        var request = new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        };

        var first = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, idempotencyKey, request));
        var firstBody = await first.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        var second = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, idempotencyKey, request));
        var secondBody = await second.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        Assert.Equal(firstBody!.Id, secondBody!.Id);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithInactiveDoctor_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        _fixture.DirectoryApiClient.ConsultantDoctorToReturn!.Status = RemoteConsultantStatus.Inactive;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithInactiveChild_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        _fixture.ClientRecordsApiClient.ChildToReturn!.Status = RemoteClientStatus.Inactive;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostDoctorAppointment_WhenSlotAlreadyBooked_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var request = new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        };
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), request));

        var secondBooking = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), request));

        Assert.Equal(HttpStatusCode.Conflict, secondBooking.StatusCode);
    }

    [Fact]
    public async Task GetDoctorAppointmentById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantA, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/doctor-appointments/{created!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListDoctorAppointments_ReturnsPagedResultEnvelope()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/doctor-appointments", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<DoctorAppointmentResponse>>();

        Assert.Equal(1, body!.TotalCount);
        Assert.Single(body.Items);
    }
}
```

- [ ] **Step 7: Generate the migration**

```bash
cd services/scheduling-api/SchedulingApi
dotnet ef migrations add AddDoctorAppointment --output-dir Migrations
cd ../../..
```

- [ ] **Step 8: Run the tests and verify they pass**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 9: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Entities/DoctorAppointment.cs services/scheduling-api/SchedulingApi/Data/SchedulingDbContext.cs services/scheduling-api/SchedulingApi/Dtos/DoctorAppointmentDtos.cs services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs services/scheduling-api/SchedulingApi/Program.cs services/scheduling-api/SchedulingApi/Migrations services/scheduling-api/SchedulingApi.Tests/DoctorAppointmentBookingTests.cs
git commit -m "feat(scheduling-api): add DoctorAppointment booking (POST/GET/list)"
```

---

### Task 3: Reschedule and cancel (PUT/DELETE)

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/DoctorAppointmentBookingTests.cs`

**Interfaces:**
- Consumes: everything from Tasks 1-2
- Produces: `PUT /doctor-appointments/{id}`, `DELETE /doctor-appointments/{id}`

- [ ] **Step 1: Add the failing tests**

Add to `services/scheduling-api/SchedulingApi.Tests/DoctorAppointmentBookingTests.cs` (append to the existing class):

```csharp
    [Fact]
    public async Task PutDoctorAppointment_ReschedulesToADifferentTime()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/doctor-appointments/{created!.Id}", tenantId, body: new UpdateDoctorAppointmentRequest
        {
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(14, 0)
        }));
        var putBody = await putResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);
        Assert.Equal(new TimeOnly(14, 0), putBody!.AppointmentTime);
    }

    [Fact]
    public async Task PutDoctorAppointment_OnCancelledAppointment_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/doctor-appointments/{created!.Id}", tenantId));

        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/doctor-appointments/{created.Id}", tenantId, body: new UpdateDoctorAppointmentRequest
        {
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(15, 0)
        }));

        Assert.Equal(HttpStatusCode.Conflict, putResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteDoctorAppointment_CancelsIt_SlotBecomesBookableAgain()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var request = new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        };
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), request));
        var created = await createResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/doctor-appointments/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var rebookResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), request));
        Assert.Equal(HttpStatusCode.Created, rebookResponse.StatusCode);
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj --filter DoctorAppointmentBookingTests`
Expected: FAIL to build — no `PUT`/`DELETE` route mapped yet.

- [ ] **Step 3: Implement the endpoints**

Modify `services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`. Add this block right after the existing `group.MapPost(...)` call's closing `});`, still inside `MapDoctorAppointmentEndpoints`:

```csharp
        group.MapPut("/{id:guid}", async (Guid id, UpdateDoctorAppointmentRequest request, SchedulingDbContext db, IDirectoryApiClient directoryClient, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var appointment = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Doctor appointment not found");
            }

            if (appointment.Status == AppointmentStatus.Cancelled)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Appointment is cancelled", detail: "A cancelled appointment cannot be rescheduled.");
            }

            if (appointment.Status == AppointmentStatus.Completed)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Appointment is completed", detail: "A completed appointment cannot be rescheduled.");
            }

            var doctor = await directoryClient.GetConsultantDoctorAsync(appointment.ConsultantDoctorId, tenantContext.TenantId);
            if (doctor is null || doctor.Status != RemoteConsultantStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["consultantDoctorId"] = ["Consultant doctor not found or not active."] });
            }

            var conflict = await db.DoctorAppointments.AnyAsync(a =>
                a.Id != id &&
                a.ConsultantDoctorId == appointment.ConsultantDoctorId &&
                a.AppointmentDate == request.AppointmentDate!.Value &&
                a.AppointmentTime == request.AppointmentTime!.Value &&
                a.Status != AppointmentStatus.Cancelled);
            if (conflict)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This doctor already has an appointment at this date and time.");
            }

            appointment.AppointmentDate = request.AppointmentDate!.Value;
            appointment.AppointmentTime = request.AppointmentTime!.Value;
            appointment.ConsultationFee = doctor.ConsultationFee;

            try
            {
                await db.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This doctor already has an appointment at this date and time.");
            }
            return Results.Ok(ToResponse(appointment));
        });

        group.MapDelete("/{id:guid}", async (Guid id, SchedulingDbContext db) =>
        {
            var appointment = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Doctor appointment not found");
            }

            appointment.Status = AppointmentStatus.Cancelled;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
```

`ConsultationFee` is re-captured from the doctor's current record on reschedule — same reasoning as `Appointment`'s `PUT` re-fetching `StartTime`/`EndTime`/`PricePerSession` from the (possibly changed) session window: a reschedule should reflect current pricing, not stale data from the original booking.

- [ ] **Step 4: Run the full test suite and verify everything passes**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 5: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs services/scheduling-api/SchedulingApi.Tests/DoctorAppointmentBookingTests.cs
git commit -m "feat(scheduling-api): add DoctorAppointment reschedule and cancel"
```

---

## Definition of done for this plan

- [ ] `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj` passes with 0 failures
- [ ] `POST /doctor-appointments` requires `Idempotency-Key`, replays on retry, and has a DB-level unique-index backstop for the booking-slot invariant from day one
- [ ] Booking rejects an inactive/nonexistent doctor or child with `ValidationProblem`, and a double-booked slot with `409`
- [ ] Reschedule re-validates the doctor is active and re-checks the conflict; cancel makes the slot bookable again
- [ ] Tenant isolation verified by-ID and by-list
- [ ] Every commit from this plan is present in `git log`
