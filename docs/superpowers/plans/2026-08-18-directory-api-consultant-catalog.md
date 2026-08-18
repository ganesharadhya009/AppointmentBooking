# Directory API Consultant Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Consultant catalog (`ConsultantService`, `ConsultantClinic`, `ConsultantDoctor`) to `DirectoryApi` — a parallel, lighter-weight catalog for external consulting doctors, ahead of a follow-up sub-project that adds their booking flow to `SchedulingApi`.

**Architecture:** Three new tenant-scoped entities on `DirectoryApi`, alongside `Branch`/`TherapyType`/`Therapist`. `ConsultantDoctor` has two FK references (service, clinic), both validated same-tenant on write, matching the established cross-reference pattern.

**Tech Stack:** .NET 9, EF Core 9.0.19 (already installed, no new packages).

## Global Constraints

- All three entities are tenant-scoped: EF Core query filter + `HasIndex(TenantId)`.
- All three share ONE `ConsultantStatus` enum (`Active`/`Inactive`, two-tier, not three) — a deliberate, documented exception to this codebase's usual "separate status enum per entity" convention (`TherapyTypeStatus`/`TherapistStatus` are distinct despite an identical shape), justified because these three entities are a tightly-coupled single feature area, unlike `TherapyType`/`Therapist` which are independent domain concepts that happen to share a shape by coincidence.
- `DELETE` on all three sets `Status = Inactive` (soft delete) — not a hard delete like `Holiday`, since `ConsultantDoctor` references both `ConsultantService` and `ConsultantClinic` and needs them to stay resolvable.
- `ConsultantDoctor.ConsultationFee` is a flat `decimal(10,2)`, not a windowed schedule — no multi-window pricing model exists for doctors in the reference material, unlike therapists' explicit 4-window model.
- `[Required]` on non-nullable value-typed DTO fields (`Status`, `ConsultationFee`) uses the nullable form (`ConsultantStatus?`, `decimal?`) — the established `[Required]`-on-value-type no-op lesson.
- Every error response is RFC 7807 via `Results.Problem(...)`/`Results.ValidationProblem(...)`.

---

### Task 1: ConsultantService and ConsultantClinic

**Files:**
- Create: `services/directory-api/DirectoryApi/Entities/ConsultantService.cs`
- Create: `services/directory-api/DirectoryApi/Entities/ConsultantClinic.cs`
- Modify: `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/ConsultantServiceDtos.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/ConsultantClinicDtos.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/ConsultantServiceEndpoints.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/ConsultantClinicEndpoints.cs`
- Modify: `services/directory-api/DirectoryApi/Program.cs`
- Create: `services/directory-api/DirectoryApi/Migrations/*`
- Test: `services/directory-api/DirectoryApi.Tests/ConsultantServiceEndpointsTests.cs`
- Test: `services/directory-api/DirectoryApi.Tests/ConsultantClinicEndpointsTests.cs`

**Interfaces:**
- Consumes: existing `DirectoryDbContext`, `PagedResult<T>`, `DataAnnotationsValidator`, `ITenantContext`
- Produces: `ConsultantStatus` enum, `POST/GET/GET-by-id/PUT/DELETE /consultant-services`, same shape for `/consultant-clinics` — the `ConsultantStatus` enum and both DbSets are consumed by Task 2's `ConsultantDoctor`

- [ ] **Step 1: Create the entities**

`services/directory-api/DirectoryApi/Entities/ConsultantService.cs`:

```csharp
namespace DirectoryApi.Entities;

public enum ConsultantStatus
{
    Active,
    Inactive
}

public class ConsultantService
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public string? PhotoUrl { get; set; }
    public ConsultantStatus Status { get; set; } = ConsultantStatus.Active;
}
```

`services/directory-api/DirectoryApi/Entities/ConsultantClinic.cs`:

```csharp
namespace DirectoryApi.Entities;

public class ConsultantClinic
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? LeadContactName { get; set; }
    public string? LeadContactPhone { get; set; }
    public ConsultantStatus Status { get; set; } = ConsultantStatus.Active;
}
```

- [ ] **Step 2: Register both entities in the DbContext**

Modify `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`. Add these two lines right after the existing `public DbSet<Holiday> Holidays => Set<Holiday>();`:

```csharp
    public DbSet<ConsultantService> ConsultantServices => Set<ConsultantService>();
    public DbSet<ConsultantClinic> ConsultantClinics => Set<ConsultantClinic>();
```

Add these two blocks inside `OnModelCreating`, right after the existing `modelBuilder.Entity<Holiday>(h => { ... });` block:

```csharp
        modelBuilder.Entity<ConsultantService>(s =>
        {
            s.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            s.HasIndex(x => x.TenantId);
            s.Property(x => x.Name).HasMaxLength(200);
        });

        modelBuilder.Entity<ConsultantClinic>(c =>
        {
            c.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            c.HasIndex(x => x.TenantId);
            c.Property(x => x.Name).HasMaxLength(200);
            c.Property(x => x.Address).HasMaxLength(500);
            c.Property(x => x.City).HasMaxLength(100);
            c.Property(x => x.State).HasMaxLength(100);
            c.Property(x => x.Country).HasMaxLength(100);
            c.Property(x => x.LeadContactName).HasMaxLength(200);
            c.Property(x => x.LeadContactPhone).HasMaxLength(20);
        });
```

- [ ] **Step 3: Create the DTOs**

`services/directory-api/DirectoryApi/Dtos/ConsultantServiceDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateConsultantServiceRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    public string? PhotoUrl { get; set; }
}

public class UpdateConsultantServiceRequest : CreateConsultantServiceRequest
{
    [Required]
    public ConsultantStatus? Status { get; set; }
}

public class ConsultantServiceResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? PhotoUrl { get; set; }
    public ConsultantStatus Status { get; set; }
}
```

`services/directory-api/DirectoryApi/Dtos/ConsultantClinicDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateConsultantClinicRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }

    [MaxLength(200)]
    public string? LeadContactName { get; set; }

    [MaxLength(20)]
    public string? LeadContactPhone { get; set; }
}

public class UpdateConsultantClinicRequest : CreateConsultantClinicRequest
{
    [Required]
    public ConsultantStatus? Status { get; set; }
}

public class ConsultantClinicResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? LeadContactName { get; set; }
    public string? LeadContactPhone { get; set; }
    public ConsultantStatus Status { get; set; }
}
```

- [ ] **Step 4: Implement the ConsultantService endpoints**

`services/directory-api/DirectoryApi/Endpoints/ConsultantServiceEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class ConsultantServiceEndpoints
{
    public static void MapConsultantServiceEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/consultant-services");

        group.MapGet("", async (int? page, int? pageSize, ConsultantStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.ConsultantServices.AsQueryable();
            if (status is not null)
            {
                query = query.Where(s => s.Status == status);
            }
            query = query.OrderBy(s => s.Name);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ConsultantServiceResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == id);
            return service is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant service not found")
                : Results.Ok(ToResponse(service));
        });

        group.MapPost("", async (CreateConsultantServiceRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var service = new ConsultantService
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                PhotoUrl = request.PhotoUrl,
                Status = ConsultantStatus.Active
            };

            db.ConsultantServices.Add(service);
            await db.SaveChangesAsync();

            return Results.Created($"/consultant-services/{service.Id}", ToResponse(service));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateConsultantServiceRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == id);
            if (service is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant service not found");
            }

            service.Name = request.Name;
            service.PhotoUrl = request.PhotoUrl;
            service.Status = request.Status!.Value;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(service));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == id);
            if (service is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant service not found");
            }

            service.Status = ConsultantStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ConsultantServiceResponse ToResponse(ConsultantService service) => new()
    {
        Id = service.Id,
        Name = service.Name,
        PhotoUrl = service.PhotoUrl,
        Status = service.Status
    };
}
```

- [ ] **Step 5: Implement the ConsultantClinic endpoints**

`services/directory-api/DirectoryApi/Endpoints/ConsultantClinicEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class ConsultantClinicEndpoints
{
    public static void MapConsultantClinicEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/consultant-clinics");

        group.MapGet("", async (int? page, int? pageSize, string? state, string? city, ConsultantStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.ConsultantClinics.AsQueryable();

            if (!string.IsNullOrWhiteSpace(state))
            {
                query = query.Where(c => c.State == state);
            }

            if (!string.IsNullOrWhiteSpace(city))
            {
                query = query.Where(c => c.City == city);
            }

            if (status is not null)
            {
                query = query.Where(c => c.Status == status);
            }

            query = query.OrderBy(c => c.Name);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ConsultantClinicResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == id);
            return clinic is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant clinic not found")
                : Results.Ok(ToResponse(clinic));
        });

        group.MapPost("", async (CreateConsultantClinicRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var clinic = new ConsultantClinic
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                Address = request.Address,
                City = request.City,
                State = request.State,
                Country = request.Country,
                LeadContactName = request.LeadContactName,
                LeadContactPhone = request.LeadContactPhone,
                Status = ConsultantStatus.Active
            };

            db.ConsultantClinics.Add(clinic);
            await db.SaveChangesAsync();

            return Results.Created($"/consultant-clinics/{clinic.Id}", ToResponse(clinic));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateConsultantClinicRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == id);
            if (clinic is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant clinic not found");
            }

            clinic.Name = request.Name;
            clinic.Address = request.Address;
            clinic.City = request.City;
            clinic.State = request.State;
            clinic.Country = request.Country;
            clinic.LeadContactName = request.LeadContactName;
            clinic.LeadContactPhone = request.LeadContactPhone;
            clinic.Status = request.Status!.Value;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(clinic));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == id);
            if (clinic is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant clinic not found");
            }

            clinic.Status = ConsultantStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ConsultantClinicResponse ToResponse(ConsultantClinic clinic) => new()
    {
        Id = clinic.Id,
        Name = clinic.Name,
        Address = clinic.Address,
        City = clinic.City,
        State = clinic.State,
        Country = clinic.Country,
        LeadContactName = clinic.LeadContactName,
        LeadContactPhone = clinic.LeadContactPhone,
        Status = clinic.Status
    };
}
```

- [ ] **Step 6: Map both endpoints in `Program.cs`**

Add these two lines right after the existing `app.MapHolidayEndpoints();` line in `services/directory-api/DirectoryApi/Program.cs`:

```csharp
app.MapConsultantServiceEndpoints();
app.MapConsultantClinicEndpoints();
```

- [ ] **Step 7: Write the tests**

`services/directory-api/DirectoryApi.Tests/ConsultantServiceEndpointsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class ConsultantServiceEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ConsultantServiceEndpointsTests(LocalDbTestFixture fixture)
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

    [Fact]
    public async Task PostConsultantService_ThenGetById_ReturnsCreatedService()
    {
        var tenantId = Guid.NewGuid();

        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantId, new CreateConsultantServiceRequest
        {
            Name = "Paediatry"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(ConsultantStatus.Active, created!.Status);

        var getResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-services/{created.Id}", tenantId));
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
    }

    [Fact]
    public async Task GetConsultantServiceById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantA, new CreateConsultantServiceRequest
        {
            Name = "ENT"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-services/{created!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteConsultantService_SetsStatusToInactive()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantId, new CreateConsultantServiceRequest
        {
            Name = "Psychiatric Consultation"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/consultant-services/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-services/{created.Id}", tenantId));
        var body = await getResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();
        Assert.Equal(ConsultantStatus.Inactive, body!.Status);
    }

    [Fact]
    public async Task GetConsultantServices_FilteredByStatus_ExcludesInactive()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantId, new CreateConsultantServiceRequest
        {
            Name = "To Deactivate"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/consultant-services/{created!.Id}", tenantId));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/consultant-services?status=Active", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ConsultantServiceResponse>>();

        Assert.DoesNotContain(body!.Items, s => s.Id == created.Id);
    }
}
```

`services/directory-api/DirectoryApi.Tests/ConsultantClinicEndpointsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class ConsultantClinicEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ConsultantClinicEndpointsTests(LocalDbTestFixture fixture)
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

    [Fact]
    public async Task PostConsultantClinic_ThenGetById_ReturnsCreatedClinic()
    {
        var tenantId = Guid.NewGuid();

        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "City Hospital",
            City = "Bengaluru",
            State = "Karnataka"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(ConsultantStatus.Active, created!.Status);
    }

    [Fact]
    public async Task GetConsultantClinics_FilteredByCityAndState_ReturnsOnlyMatching()
    {
        var tenantId = Guid.NewGuid();
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "Matching Clinic",
            City = "Bengaluru",
            State = "Karnataka"
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "Non-Matching Clinic",
            City = "Chennai",
            State = "Tamil Nadu"
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/consultant-clinics?city=Bengaluru&state=Karnataka", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ConsultantClinicResponse>>();

        Assert.Single(body!.Items);
        Assert.Equal("Matching Clinic", body.Items[0].Name);
    }

    [Fact]
    public async Task DeleteConsultantClinic_SetsStatusToInactive()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "Test Clinic"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/consultant-clinics/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-clinics/{created.Id}", tenantId));
        var body = await getResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();
        Assert.Equal(ConsultantStatus.Inactive, body!.Status);
    }

    [Fact]
    public async Task GetConsultantClinicById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantA, new CreateConsultantClinicRequest
        {
            Name = "Tenant A Clinic"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-clinics/{created!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
```

- [ ] **Step 8: Generate the migration**

```bash
cd services/directory-api/DirectoryApi
dotnet ef migrations add AddConsultantServiceAndClinic --output-dir Migrations
cd ../../..
```

- [ ] **Step 9: Run the tests and verify they pass**

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 10: Commit**

```bash
git add services/directory-api/DirectoryApi/Entities/ConsultantService.cs services/directory-api/DirectoryApi/Entities/ConsultantClinic.cs services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs services/directory-api/DirectoryApi/Dtos/ConsultantServiceDtos.cs services/directory-api/DirectoryApi/Dtos/ConsultantClinicDtos.cs services/directory-api/DirectoryApi/Endpoints/ConsultantServiceEndpoints.cs services/directory-api/DirectoryApi/Endpoints/ConsultantClinicEndpoints.cs services/directory-api/DirectoryApi/Program.cs services/directory-api/DirectoryApi/Migrations services/directory-api/DirectoryApi.Tests/ConsultantServiceEndpointsTests.cs services/directory-api/DirectoryApi.Tests/ConsultantClinicEndpointsTests.cs
git commit -m "feat(directory-api): add ConsultantService and ConsultantClinic catalogs"
```

---

### Task 2: ConsultantDoctor (dual-FK, filterable)

**Files:**
- Create: `services/directory-api/DirectoryApi/Entities/ConsultantDoctor.cs`
- Modify: `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/ConsultantDoctorDtos.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/ConsultantDoctorEndpoints.cs`
- Modify: `services/directory-api/DirectoryApi/Program.cs`
- Create: `services/directory-api/DirectoryApi/Migrations/*`
- Test: `services/directory-api/DirectoryApi.Tests/ConsultantDoctorEndpointsTests.cs`

**Interfaces:**
- Consumes: `ConsultantStatus`, `ConsultantService`, `ConsultantClinic` (Task 1)
- Produces: `POST/GET/GET-by-id/PUT/DELETE /consultant-doctors` — consumed by the follow-up `DoctorAppointment` sub-project on `SchedulingApi`

- [ ] **Step 1: Create the entity**

`services/directory-api/DirectoryApi/Entities/ConsultantDoctor.cs`:

```csharp
namespace DirectoryApi.Entities;

public class ConsultantDoctor
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public Guid ConsultantClinicId { get; set; }
    public decimal ConsultationFee { get; set; }
    public ConsultantStatus Status { get; set; } = ConsultantStatus.Active;
}
```

- [ ] **Step 2: Register the entity in the DbContext**

Modify `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`. Add this line right after the existing `public DbSet<ConsultantClinic> ConsultantClinics => Set<ConsultantClinic>();`:

```csharp
    public DbSet<ConsultantDoctor> ConsultantDoctors => Set<ConsultantDoctor>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<ConsultantClinic>(c => { ... });` block:

```csharp
        modelBuilder.Entity<ConsultantDoctor>(d =>
        {
            d.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            d.HasIndex(x => x.TenantId);
            d.HasIndex(x => x.ConsultantServiceId);
            d.HasIndex(x => x.ConsultantClinicId);
            d.Property(x => x.Name).HasMaxLength(200);
            d.Property(x => x.ConsultationFee).HasColumnType("decimal(10,2)");
        });
```

No `HasForeignKey`/navigation properties are configured here — `ConsultantServiceId`/`ConsultantClinicId` are validated at the application level in the endpoint handlers (Step 4), matching how `TherapistAssignment.BranchId`/`TherapyTypeId` are plain `Guid` columns validated in code rather than EF Core-enforced foreign keys, since `ConsultantDoctor` shouldn't be blocked from existing if a referenced service/clinic is later deactivated (soft delete) — a hard FK constraint would prevent that deactivation.

- [ ] **Step 3: Create the DTOs**

`services/directory-api/DirectoryApi/Dtos/ConsultantDoctorDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateConsultantDoctorRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required]
    public Guid ConsultantServiceId { get; set; }

    [Required]
    public Guid ConsultantClinicId { get; set; }

    [Required]
    public decimal? ConsultationFee { get; set; }
}

public class UpdateConsultantDoctorRequest : CreateConsultantDoctorRequest
{
    [Required]
    public ConsultantStatus? Status { get; set; }
}

public class ConsultantDoctorResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public Guid ConsultantClinicId { get; set; }
    public decimal ConsultationFee { get; set; }
    public ConsultantStatus Status { get; set; }
}
```

- [ ] **Step 4: Implement the endpoints**

`services/directory-api/DirectoryApi/Endpoints/ConsultantDoctorEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class ConsultantDoctorEndpoints
{
    public static void MapConsultantDoctorEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/consultant-doctors");

        group.MapGet("", async (int? page, int? pageSize, Guid? consultantServiceId, string? city, ConsultantStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.ConsultantDoctors.AsQueryable();

            if (consultantServiceId is not null)
            {
                query = query.Where(d => d.ConsultantServiceId == consultantServiceId);
            }

            if (status is not null)
            {
                query = query.Where(d => d.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(city))
            {
                var clinicIdsInCity = db.ConsultantClinics.Where(c => c.City == city).Select(c => c.Id);
                query = query.Where(d => clinicIdsInCity.Contains(d.ConsultantClinicId));
            }

            query = query.OrderBy(d => d.Name);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ConsultantDoctorResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var doctor = await db.ConsultantDoctors.FirstOrDefaultAsync(d => d.Id == id);
            return doctor is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant doctor not found")
                : Results.Ok(ToResponse(doctor));
        });

        group.MapPost("", async (CreateConsultantDoctorRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == request.ConsultantServiceId);
            if (service is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantServiceId"] = ["Consultant service not found or does not belong to this tenant."]
                });
            }

            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == request.ConsultantClinicId);
            if (clinic is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantClinicId"] = ["Consultant clinic not found or does not belong to this tenant."]
                });
            }

            var doctor = new ConsultantDoctor
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                ConsultantServiceId = request.ConsultantServiceId,
                ConsultantClinicId = request.ConsultantClinicId,
                ConsultationFee = request.ConsultationFee!.Value,
                Status = ConsultantStatus.Active
            };

            db.ConsultantDoctors.Add(doctor);
            await db.SaveChangesAsync();

            return Results.Created($"/consultant-doctors/{doctor.Id}", ToResponse(doctor));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateConsultantDoctorRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var doctor = await db.ConsultantDoctors.FirstOrDefaultAsync(d => d.Id == id);
            if (doctor is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant doctor not found");
            }

            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == request.ConsultantServiceId);
            if (service is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantServiceId"] = ["Consultant service not found or does not belong to this tenant."]
                });
            }

            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == request.ConsultantClinicId);
            if (clinic is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantClinicId"] = ["Consultant clinic not found or does not belong to this tenant."]
                });
            }

            doctor.Name = request.Name;
            doctor.ConsultantServiceId = request.ConsultantServiceId;
            doctor.ConsultantClinicId = request.ConsultantClinicId;
            doctor.ConsultationFee = request.ConsultationFee!.Value;
            doctor.Status = request.Status!.Value;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(doctor));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var doctor = await db.ConsultantDoctors.FirstOrDefaultAsync(d => d.Id == id);
            if (doctor is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant doctor not found");
            }

            doctor.Status = ConsultantStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ConsultantDoctorResponse ToResponse(ConsultantDoctor doctor) => new()
    {
        Id = doctor.Id,
        Name = doctor.Name,
        ConsultantServiceId = doctor.ConsultantServiceId,
        ConsultantClinicId = doctor.ConsultantClinicId,
        ConsultationFee = doctor.ConsultationFee,
        Status = doctor.Status
    };
}
```

- [ ] **Step 5: Map the endpoint in `Program.cs`**

Add this line right after the existing `app.MapConsultantClinicEndpoints();` line in `services/directory-api/DirectoryApi/Program.cs`:

```csharp
app.MapConsultantDoctorEndpoints();
```

- [ ] **Step 6: Write the tests**

`services/directory-api/DirectoryApi.Tests/ConsultantDoctorEndpointsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class ConsultantDoctorEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ConsultantDoctorEndpointsTests(LocalDbTestFixture fixture)
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

    private async Task<(Guid serviceId, Guid clinicId)> CreateServiceAndClinicAsync(Guid tenantId, string? city = null)
    {
        var serviceResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantId, new CreateConsultantServiceRequest
        {
            Name = "Test Service"
        }));
        var service = await serviceResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();

        var clinicResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "Test Clinic",
            City = city
        }));
        var clinic = await clinicResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();

        return (service!.Id, clinic!.Id);
    }

    [Fact]
    public async Task PostConsultantDoctor_WithValidReferences_CreatesDoctor()
    {
        var tenantId = Guid.NewGuid();
        var (serviceId, clinicId) = await CreateServiceAndClinicAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Dr. Test",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = clinicId,
            ConsultationFee = 800
        }));
        var body = await response.Content.ReadFromJsonAsync<ConsultantDoctorResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(800, body!.ConsultationFee);
    }

    [Fact]
    public async Task PostConsultantDoctor_WithCrossTenantService_ReturnsValidationProblem()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var (serviceId, _) = await CreateServiceAndClinicAsync(tenantA);
        var (_, clinicId) = await CreateServiceAndClinicAsync(tenantB);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantB, new CreateConsultantDoctorRequest
        {
            Name = "Dr. Cross Tenant",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = clinicId,
            ConsultationFee = 500
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostConsultantDoctor_WithNonexistentClinic_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var (serviceId, _) = await CreateServiceAndClinicAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Dr. No Clinic",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = Guid.NewGuid(),
            ConsultationFee = 500
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetConsultantDoctors_FilteredByServiceAndCity_ReturnsOnlyMatching()
    {
        var tenantId = Guid.NewGuid();
        var (serviceId, clinicId) = await CreateServiceAndClinicAsync(tenantId, city: "Mumbai");
        var (otherServiceId, otherClinicId) = await CreateServiceAndClinicAsync(tenantId, city: "Delhi");

        await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Matching Doctor",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = clinicId,
            ConsultationFee = 700
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Non-Matching Doctor",
            ConsultantServiceId = otherServiceId,
            ConsultantClinicId = otherClinicId,
            ConsultationFee = 700
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/consultant-doctors?consultantServiceId={serviceId}&city=Mumbai", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ConsultantDoctorResponse>>();

        Assert.Single(body!.Items);
        Assert.Equal("Matching Doctor", body.Items[0].Name);
    }

    [Fact]
    public async Task DeleteConsultantDoctor_SetsStatusToInactive()
    {
        var tenantId = Guid.NewGuid();
        var (serviceId, clinicId) = await CreateServiceAndClinicAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Dr. To Delete",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = clinicId,
            ConsultationFee = 500
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantDoctorResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/consultant-doctors/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-doctors/{created.Id}", tenantId));
        var body = await getResponse.Content.ReadFromJsonAsync<ConsultantDoctorResponse>();
        Assert.Equal(ConsultantStatus.Inactive, body!.Status);
    }
}
```

- [ ] **Step 7: Generate the migration**

```bash
cd services/directory-api/DirectoryApi
dotnet ef migrations add AddConsultantDoctor --output-dir Migrations
cd ../../..
```

- [ ] **Step 8: Run the tests and verify they pass**

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 9: Commit**

```bash
git add services/directory-api/DirectoryApi/Entities/ConsultantDoctor.cs services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs services/directory-api/DirectoryApi/Dtos/ConsultantDoctorDtos.cs services/directory-api/DirectoryApi/Endpoints/ConsultantDoctorEndpoints.cs services/directory-api/DirectoryApi/Program.cs services/directory-api/DirectoryApi/Migrations services/directory-api/DirectoryApi.Tests/ConsultantDoctorEndpointsTests.cs
git commit -m "feat(directory-api): add ConsultantDoctor catalog with dual-FK validation"
```

---

## Definition of done for this plan

- [ ] `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj` passes with 0 failures
- [ ] All three entities have working CRUD with tenant isolation, matching every prior sub-project's coverage
- [ ] `ConsultantDoctor` correctly rejects a cross-tenant or nonexistent `ConsultantServiceId`/`ConsultantClinicId`
- [ ] `GET /consultant-clinics` filters by `state`/`city`/`status`; `GET /consultant-doctors` filters by `consultantServiceId`/`city`/`status`
- [ ] Every commit from this plan is present in `git log`
