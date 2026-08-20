# Phase 5 Parent-App Filters, Tenant Billing, Admin Directory & Swagger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out Phase 5's backend surface, add `TenantSubscription` and `StaffMember` to `DirectoryApi`, and add Swagger UI to all four .NET services. Based on `docs/superpowers/specs/2026-08-20-phase5-tenant-billing-admin-swagger-design.md`.

**Architecture:** Four independent tasks — two tiny filter additions (one per service), one `DirectoryApi` CRUD task covering two new entities, one Swagger-config task touching all four services with the same mechanical pattern.

**Tech Stack:** .NET 9, EF Core 9.0.19, `Swashbuckle.AspNetCore` (new dependency, Task 4 only).

## Global Constraints

- **Review mode: single sonnet-tier reviewer per task, no separate final whole-branch review** — per the 2026-08-20 cost checkpoint. CRUD/filter work and tooling config, no money movement, no new risk surface.
- **Unit/integration test-writing is deferred to a later consolidated pass** (standing project policy). No new `[Fact]` tests. Acceptance per task: builds clean, existing suite passes unchanged.
- All new filters are optional; omitting them must reproduce the exact current behavior of the endpoint being enhanced.
- `TenantSubscription`/`StaffMember` follow every existing `DirectoryApi` entity's conventions exactly (tenant-scoped except where noted, `[Required]` on nullable value types, RFC 7807, `PagedResult<T>`).
- Swagger UI is **Development-environment-only** (`app.Environment.IsDevelopment()`) on every service — never exposed by default in any other environment.

---

### Task 1: `ClientRecordsApi` — `parentId` filter on `GET /children`

**Files:**
- Modify: `services/client-records-api/ClientRecordsApi/Endpoints/ChildEndpoints.cs`

- [ ] **Step 1: Add the filter**

In `services/client-records-api/ClientRecordsApi/Endpoints/ChildEndpoints.cs`, replace this block:

```csharp
        group.MapGet("", async (int? page, int? pageSize, ClientRecordsDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Children.OrderBy(c => c.Name);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ChildResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });
```

with:

```csharp
        group.MapGet("", async (int? page, int? pageSize, Guid? parentId, ClientRecordsDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var filtered = db.Children.AsQueryable();
            if (parentId is not null)
            {
                filtered = filtered.Where(c => c.ParentId == parentId.Value);
            }

            var query = filtered.OrderBy(c => c.Name);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ChildResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });
```

- [ ] **Step 2: Build and run the existing test suite as a regression check**

Run: `dotnet build services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj`
Expected: all existing tests passing, unchanged.

- [ ] **Step 3: Commit**

```bash
git add services/client-records-api/ClientRecordsApi/Endpoints/ChildEndpoints.cs
git commit -m "feat(client-records-api): add parentId filter to GET /children for Phase 5 (tests deferred to later pass)"
```

---

### Task 2: `SchedulingApi` — `childId` filter on appointment lists

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`

- [ ] **Step 1: Add the filter to `GET /appointments`**

In `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`, find the `group.MapGet("", async (int? page, int? pageSize, DateOnly? dateFrom, DateOnly? dateTo, Guid? branchId, AppointmentStatus? status, SchedulingDbContext db) => { ... });` handler (added in the Phase 3 Reports sub-project). Add a `Guid? childId` parameter to its signature (after `status`, before `SchedulingDbContext db`), and add this filter clause alongside the existing ones inside the handler body (after the `status` filter block):

```csharp
            if (childId is not null)
            {
                filtered = filtered.Where(a => a.ChildId == childId.Value);
            }
```

- [ ] **Step 2: Add the filter to `GET /doctor-appointments`**

In `services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`, find the `group.MapGet("", async (int? page, int? pageSize, DateOnly? dateFrom, DateOnly? dateTo, AppointmentStatus? status, SchedulingDbContext db) => { ... });` handler (also from Phase 3 Reports). Add a `Guid? childId` parameter (after `status`, before `SchedulingDbContext db`), and add this filter clause alongside the existing ones (after the `status` filter block):

```csharp
            if (childId is not null)
            {
                filtered = filtered.Where(a => a.ChildId == childId.Value);
            }
```

- [ ] **Step 3: Build and run the existing test suite as a regression check**

Run: `dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 49/49 passing, unchanged.

- [ ] **Step 4: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs
git commit -m "feat(scheduling-api): add childId filter to appointment lists for Phase 5 (tests deferred to later pass)"
```

---

### Task 3: `DirectoryApi` — `TenantSubscription` and `StaffMember`

**Files:**
- Create: `services/directory-api/DirectoryApi/Entities/TenantSubscription.cs`
- Create: `services/directory-api/DirectoryApi/Entities/StaffMember.cs`
- Modify: `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/TenantSubscriptionDtos.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/StaffMemberDtos.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/TenantSubscriptionEndpoints.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/StaffMemberEndpoints.cs`
- Modify: `services/directory-api/DirectoryApi/Program.cs`
- Create: `services/directory-api/DirectoryApi/Migrations/*`

**Interfaces:**
- Produces: `POST/GET /tenant-subscriptions`, `GET/PUT /tenant-subscriptions/{id}`, `POST/GET /staff-members`, `GET/PUT/DELETE /staff-members/{id}`.

- [ ] **Step 1: Create the entities**

`services/directory-api/DirectoryApi/Entities/TenantSubscription.cs`:

```csharp
namespace DirectoryApi.Entities;

public enum SubscriptionRecordStatus
{
    Active,
    PastDue,
    Cancelled
}

public enum BillingCycle
{
    Monthly,
    Annual
}

// Platform-provisioned, same trust boundary as TenantEndpoints.cs -- not a public self-serve
// signup surface. See design spec §2 for why: an unauthenticated public signup form creating
// billing-relevant records is exactly the abuse vector the platform's deferred-auth decision
// already rules out elsewhere.
public class TenantSubscription
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string PlanName { get; set; }
    public SubscriptionRecordStatus Status { get; set; }
    public BillingCycle BillingCycle { get; set; }
    public DateOnly NextBillingDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

`services/directory-api/DirectoryApi/Entities/StaffMember.cs`:

```csharp
namespace DirectoryApi.Entities;

public enum StaffRole
{
    Admin,
    FrontDesk,
    Therapist,
    DoctorCoordinator
}

// Credential-free directory stub -- Email is a contact field, not a login identifier. No
// password/credential of any kind exists on this entity. Role is a label, not an authorization
// mechanism -- nothing on the platform checks it to gate anything yet. See design spec §3.
public class StaffMember
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string? Phone { get; set; }
    public StaffRole Role { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 2: Register both entities in the DbContext**

Modify `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`. Add these two lines right after the existing `public DbSet<Poster> Posters => Set<Poster>();`/`public DbSet<AppVersion> AppVersions => Set<AppVersion>();` lines (whichever is last in that block):

```csharp
    public DbSet<TenantSubscription> TenantSubscriptions => Set<TenantSubscription>();
    public DbSet<StaffMember> StaffMembers => Set<StaffMember>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<AppVersion>(a => { ... });` block:

```csharp
        modelBuilder.Entity<TenantSubscription>(s =>
        {
            // Tenant-scoped by TenantId like everything else, but NOT via the usual
            // HasQueryFilter(x => x.TenantId == tenantContext.TenantId) pattern -- a caller
            // provisioning/managing a tenant's subscription is, by definition, acting on that
            // exact tenant, so the standard "current caller's own tenant" filter is what every
            // endpoint here already enforces implicitly via TenantId matching the request's
            // resolved tenant. HasIndex + a uniqueness constraint (one subscription per tenant)
            // is what actually matters here.
            s.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            s.HasIndex(x => x.TenantId).IsUnique();
            s.Property(x => x.PlanName).HasMaxLength(100);
        });

        modelBuilder.Entity<StaffMember>(s =>
        {
            s.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            s.HasIndex(x => x.TenantId);
            s.Property(x => x.Name).HasMaxLength(200);
            s.Property(x => x.Email).HasMaxLength(320);
            s.Property(x => x.Phone).HasMaxLength(50);
        });
```

**Note on the comment above:** on reflection while implementing, if `TenantSubscription`'s `HasQueryFilter` line reads as confusing/redundant with the comment's own reasoning, keep the `HasQueryFilter` call anyway — it's still correct and consistent with every other entity in this file, the comment is just explaining why the *uniqueness* constraint (not the filter) is this entity's interesting property. Do not remove the `HasQueryFilter` call.

- [ ] **Step 3: Create the DTOs**

`services/directory-api/DirectoryApi/Dtos/TenantSubscriptionDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateTenantSubscriptionRequest
{
    [Required]
    public Guid TenantId { get; set; }

    [Required, MaxLength(100)]
    public required string PlanName { get; set; }

    [Required]
    public SubscriptionRecordStatus? Status { get; set; }

    [Required]
    public BillingCycle? BillingCycle { get; set; }

    [Required]
    public DateOnly? NextBillingDate { get; set; }
}

public class UpdateTenantSubscriptionRequest
{
    [Required, MaxLength(100)]
    public required string PlanName { get; set; }

    [Required]
    public SubscriptionRecordStatus? Status { get; set; }

    [Required]
    public BillingCycle? BillingCycle { get; set; }

    [Required]
    public DateOnly? NextBillingDate { get; set; }
}

public class TenantSubscriptionResponse
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string PlanName { get; set; }
    public SubscriptionRecordStatus Status { get; set; }
    public BillingCycle BillingCycle { get; set; }
    public DateOnly NextBillingDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

`services/directory-api/DirectoryApi/Dtos/StaffMemberDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateStaffMemberRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required, MaxLength(320), EmailAddress]
    public required string Email { get; set; }

    [MaxLength(50)]
    public string? Phone { get; set; }

    [Required]
    public StaffRole? Role { get; set; }
}

public class UpdateStaffMemberRequest : CreateStaffMemberRequest
{
    [Required]
    public bool? IsActive { get; set; }
}

public class StaffMemberResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string? Phone { get; set; }
    public StaffRole Role { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 4: Implement the `TenantSubscription` endpoints**

`services/directory-api/DirectoryApi/Endpoints/TenantSubscriptionEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

// SECURITY: same posture as TenantEndpoints.cs -- intentionally unauthenticated, trusted-network
// / internal-tooling only. Not a public self-serve signup surface. See design spec §2.
public static class TenantSubscriptionEndpoints
{
    public static void MapTenantSubscriptionEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/tenant-subscriptions");

        group.MapGet("", async (int? page, int? pageSize, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.TenantSubscriptions.OrderByDescending(s => s.CreatedAt).ThenBy(s => s.Id);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<TenantSubscriptionResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var subscription = await db.TenantSubscriptions.FirstOrDefaultAsync(s => s.Id == id);
            return subscription is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Tenant subscription not found")
                : Results.Ok(ToResponse(subscription));
        });

        group.MapPost("", async (CreateTenantSubscriptionRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == request.TenantId);
            if (tenant is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["tenantId"] = ["Tenant not found."] });
            }

            var existing = await db.TenantSubscriptions.AnyAsync(s => s.TenantId == request.TenantId);
            if (existing)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Subscription already exists", detail: "This tenant already has a subscription record.");
            }

            var subscription = new TenantSubscription
            {
                Id = Guid.NewGuid(),
                TenantId = request.TenantId,
                PlanName = request.PlanName,
                Status = request.Status!.Value,
                BillingCycle = request.BillingCycle!.Value,
                NextBillingDate = request.NextBillingDate!.Value,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.TenantSubscriptions.Add(subscription);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Subscription already exists", detail: "This tenant already has a subscription record.");
            }

            return Results.Created($"/tenant-subscriptions/{subscription.Id}", ToResponse(subscription));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateTenantSubscriptionRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var subscription = await db.TenantSubscriptions.FirstOrDefaultAsync(s => s.Id == id);
            if (subscription is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Tenant subscription not found");
            }

            subscription.PlanName = request.PlanName;
            subscription.Status = request.Status!.Value;
            subscription.BillingCycle = request.BillingCycle!.Value;
            subscription.NextBillingDate = request.NextBillingDate!.Value;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(subscription));
        });
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };

    private static TenantSubscriptionResponse ToResponse(TenantSubscription subscription) => new()
    {
        Id = subscription.Id,
        TenantId = subscription.TenantId,
        PlanName = subscription.PlanName,
        Status = subscription.Status,
        BillingCycle = subscription.BillingCycle,
        NextBillingDate = subscription.NextBillingDate,
        CreatedAt = subscription.CreatedAt
    };
}
```

- [ ] **Step 5: Implement the `StaffMember` endpoints**

`services/directory-api/DirectoryApi/Endpoints/StaffMemberEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class StaffMemberEndpoints
{
    public static void MapStaffMemberEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/staff-members");

        group.MapGet("", async (int? page, int? pageSize, StaffRole? role, bool? isActive, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.StaffMembers.AsQueryable();
            if (role is not null)
            {
                query = query.Where(s => s.Role == role.Value);
            }
            if (isActive is not null)
            {
                query = query.Where(s => s.IsActive == isActive.Value);
            }
            var ordered = query.OrderBy(s => s.Name).ThenBy(s => s.Id);

            var totalCount = await ordered.CountAsync();
            var items = await ordered.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<StaffMemberResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var staffMember = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id);
            return staffMember is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Staff member not found")
                : Results.Ok(ToResponse(staffMember));
        });

        group.MapPost("", async (CreateStaffMemberRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var staffMember = new StaffMember
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                Email = request.Email,
                Phone = request.Phone,
                Role = request.Role!.Value,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.StaffMembers.Add(staffMember);
            await db.SaveChangesAsync();

            return Results.Created($"/staff-members/{staffMember.Id}", ToResponse(staffMember));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateStaffMemberRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var staffMember = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id);
            if (staffMember is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Staff member not found");
            }

            staffMember.Name = request.Name;
            staffMember.Email = request.Email;
            staffMember.Phone = request.Phone;
            staffMember.Role = request.Role!.Value;
            staffMember.IsActive = request.IsActive!.Value;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(staffMember));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var staffMember = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id);
            if (staffMember is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Staff member not found");
            }

            db.StaffMembers.Remove(staffMember);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static StaffMemberResponse ToResponse(StaffMember staffMember) => new()
    {
        Id = staffMember.Id,
        Name = staffMember.Name,
        Email = staffMember.Email,
        Phone = staffMember.Phone,
        Role = staffMember.Role,
        IsActive = staffMember.IsActive,
        CreatedAt = staffMember.CreatedAt
    };
}
```

- [ ] **Step 6: Wire the endpoints into `Program.cs`**

In `services/directory-api/DirectoryApi/Program.cs`, add these two lines right after the existing `app.MapAppVersionEndpoints();` line:

```csharp
app.MapTenantSubscriptionEndpoints();
app.MapStaffMemberEndpoints();
```

- [ ] **Step 7: Generate the migration**

```bash
cd services/directory-api/DirectoryApi
dotnet ef migrations add AddTenantSubscriptionAndStaffMember --output-dir Migrations
cd ../../..
```

- [ ] **Step 8: Build and run the existing test suite as a regression check**

Run: `dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: 71/71 passing, unchanged.

- [ ] **Step 9: Commit**

```bash
git add services/directory-api/DirectoryApi/Entities/TenantSubscription.cs services/directory-api/DirectoryApi/Entities/StaffMember.cs services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs services/directory-api/DirectoryApi/Dtos/TenantSubscriptionDtos.cs services/directory-api/DirectoryApi/Dtos/StaffMemberDtos.cs services/directory-api/DirectoryApi/Endpoints/TenantSubscriptionEndpoints.cs services/directory-api/DirectoryApi/Endpoints/StaffMemberEndpoints.cs services/directory-api/DirectoryApi/Program.cs services/directory-api/DirectoryApi/Migrations
git commit -m "feat(directory-api): add TenantSubscription and StaffMember (tests deferred to later pass)"
```

---

### Task 4: Swagger/OpenAPI on all four .NET services

**Files:**
- Modify: `services/directory-api/DirectoryApi/DirectoryApi.csproj`, `Program.cs`
- Modify: `services/scheduling-api/SchedulingApi/SchedulingApi.csproj`, `Program.cs`
- Modify: `services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj`, `Program.cs`
- Modify: `services/billing-api/BillingApi/BillingApi.csproj`, `Program.cs`

- [ ] **Step 1: Add the package to all four projects**

```bash
cd services/directory-api/DirectoryApi && dotnet add package Swashbuckle.AspNetCore && cd ../../..
cd services/scheduling-api/SchedulingApi && dotnet add package Swashbuckle.AspNetCore && cd ../../..
cd services/client-records-api/ClientRecordsApi && dotnet add package Swashbuckle.AspNetCore && cd ../../..
cd services/billing-api/BillingApi && dotnet add package Swashbuckle.AspNetCore && cd ../../..
```

Let NuGet resolve the current stable version compatible with .NET 9 — do not hand-pin a version number.

- [ ] **Step 2: Wire Swagger into `DirectoryApi`'s `Program.cs`**

Add `using Microsoft.OpenApi.Models;` to the top of `services/directory-api/DirectoryApi/Program.cs`.

Add this block right after the existing `builder.Services.AddProblemDetails();` line:

```csharp
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "DirectoryApi", Version = "v1" });
    options.AddSecurityDefinition("X-Tenant-Id", new OpenApiSecurityScheme
    {
        Name = "X-Tenant-Id",
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Description = "Tenant identifier (GUID) -- required on every endpoint except /health."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "X-Tenant-Id" } },
            Array.Empty<string>()
        }
    });
});
```

Add this block right after the existing `var app = builder.Build();` line (before the migration-running block):

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
```

- [ ] **Step 3: Wire Swagger into `SchedulingApi`'s `Program.cs`**

Same as Step 2, applied to `services/scheduling-api/SchedulingApi/Program.cs`, with `Title = "SchedulingApi"` in the `OpenApiInfo`. Same `X-Tenant-Id` security definition (this service uses the identical stub-tenancy pattern).

- [ ] **Step 4: Wire Swagger into `ClientRecordsApi`'s `Program.cs`**

Same as Step 2, applied to `services/client-records-api/ClientRecordsApi/Program.cs`, with `Title = "ClientRecordsApi"`.

- [ ] **Step 5: Wire Swagger into `BillingApi`'s `Program.cs`**

Same as Step 2, applied to `services/billing-api/BillingApi/Program.cs`, with `Title = "BillingApi"`, **plus one extra security definition** for the payment-checkout callback's shared-secret header — add this second `AddSecurityDefinition` call right after the `X-Tenant-Id` one, and add a second entry to the `AddSecurityRequirement` call alongside the `X-Tenant-Id` one:

```csharp
    options.AddSecurityDefinition("X-Gateway-Webhook-Secret", new OpenApiSecurityScheme
    {
        Name = "X-Gateway-Webhook-Secret",
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Description = "Required only on POST /payment-checkouts/{id}/callback -- the configured PaymentGateway:WebhookSecret value."
    });
```

```csharp
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "X-Gateway-Webhook-Secret" } },
            Array.Empty<string>()
```

(as a second key-value pair inside the same `OpenApiSecurityRequirement` object, alongside the existing `X-Tenant-Id` entry.)

- [ ] **Step 6: Build all four services**

```bash
dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj
dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj
dotnet build services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj
dotnet build services/billing-api/BillingApi/BillingApi.csproj
```

Expected: 0 errors on all four.

- [ ] **Step 7: Manual smoke check on one service (representative, not all four)**

```bash
cd services/directory-api/DirectoryApi
dotnet run &
sleep 5
curl -s -o /dev/null -w "swagger.json: %{http_code}\n" http://localhost:5256/swagger/v1/swagger.json
curl -s -o /dev/null -w "swagger UI: %{http_code}\n" http://localhost:5256/swagger/index.html
kill %1
cd ../../..
```

Expected: both `200`. Trust the identical pattern for the other three services rather than repeating the full smoke check four times — the wiring is byte-for-byte the same shape in each.

- [ ] **Step 8: Run each service's existing test suite as a regression check**

```bash
dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj
dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj
dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj
dotnet test services/billing-api/BillingApi.Tests/BillingApi.Tests.csproj
```

Expected: every existing suite passes unchanged (`BillingApi.Tests` currently has no test methods at all — it should still build and report 0 tests, not fail).

- [ ] **Step 9: Commit**

```bash
git add services/directory-api/DirectoryApi/DirectoryApi.csproj services/directory-api/DirectoryApi/Program.cs services/scheduling-api/SchedulingApi/SchedulingApi.csproj services/scheduling-api/SchedulingApi/Program.cs services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj services/client-records-api/ClientRecordsApi/Program.cs services/billing-api/BillingApi/BillingApi.csproj services/billing-api/BillingApi/Program.cs
git commit -m "feat: add Swagger/OpenAPI UI (Development-only) to all four .NET services for manual API testing"
```

---

## Definition of done for this plan

- [ ] `dotnet build` succeeds with 0 errors on all four .NET services
- [ ] Every existing test suite passes unchanged across all four services
- [ ] Swagger UI reachable at `/swagger` on all four services in Development
- [ ] All four task commits are present in `git log`
- [ ] **Test coverage for this plan's new endpoints remains outstanding** — tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier
- [ ] Phase 5's stub-trust-model decision, and the tenant-billing/admin-directory scoping decisions, are documented in `DEFERRED-AND-TODO.md`
