# DirectoryApi Banners, Posters & App Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Banner`, `Poster`, and `AppVersion` CRUD to `DirectoryApi`. Based on `docs/superpowers/specs/2026-08-20-directory-api-banners-posters-appversion-design.md`.

**Architecture:** Standard tenant-scoped CRUD for `Banner`/`Poster` (Task 1), following every existing `DirectoryApi` entity's conventions exactly. `AppVersion` (Task 2) is platform-scoped — no `TenantId` column, no query filter — modeled on the existing `Tenant` entity.

**Tech Stack:** .NET 9, EF Core 9.0.19. No new packages.

## Global Constraints

- **Review mode: single sonnet-tier reviewer per task, no separate final whole-branch review** — per the 2026-08-20 cost checkpoint. Low-risk: simple CRUD, one service, no cross-service calls, no money, no concurrency-sensitive writes.
- **Unit/integration test-writing is deferred to a later consolidated pass** (standing project policy). No new `[Fact]` tests in this plan. Acceptance per task: builds clean, existing suite passes unchanged.
- `Banner`/`Poster` are tenant-scoped: EF Core query filter + `HasIndex(TenantId)`.
- `AppVersion` is **platform-scoped — no `TenantId` field, no query filter**, exactly like the existing `Tenant` entity. It still requires a valid `X-Tenant-Id` header to pass `TenantIdMiddleware` (an already-established platform quirk for platform-scoped resources — `TenantEndpoints.cs` behaves identically today).
- Every write handler using `[Required]` on a non-nullable value type must use the nullable form (`Guid?`, `DateOnly?`, enum`?`) per the platform's known `[Required]`-is-a-no-op bug class (documented in `DEFERRED-AND-TODO.md`) — do not reintroduce it.
- Every error response is RFC 7807.

---

### Task 1: `Banner` and `Poster`

**Files:**
- Create: `services/directory-api/DirectoryApi/Entities/Banner.cs`
- Create: `services/directory-api/DirectoryApi/Entities/Poster.cs`
- Modify: `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/BannerDtos.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/PosterDtos.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/BannerEndpoints.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/PosterEndpoints.cs`
- Modify: `services/directory-api/DirectoryApi/Program.cs`
- Create: `services/directory-api/DirectoryApi/Migrations/*`

**Interfaces:**
- Produces: `POST/GET /banners`, `GET/PUT/DELETE /banners/{id}`, `POST/GET /posters`, `GET/PUT/DELETE /posters/{id}`.

- [ ] **Step 1: Create the entities**

`services/directory-api/DirectoryApi/Entities/Banner.cs`:

```csharp
namespace DirectoryApi.Entities;

public class Banner
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string ImageUrl { get; set; }
    public required string WatermarkTitle { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

`services/directory-api/DirectoryApi/Entities/Poster.cs`:

```csharp
namespace DirectoryApi.Entities;

public enum PosterPosition
{
    Top,
    Bottom,
    Popup
}

public class Poster
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Type { get; set; }
    public PosterPosition Position { get; set; }
    public DateOnly ActiveFrom { get; set; }
    public DateOnly ActiveTo { get; set; }
    public int Priority { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 2: Register both entities in the DbContext**

Modify `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`. Add these two lines right after the existing `public DbSet<SupportTicketMessage> SupportTicketMessages => Set<SupportTicketMessage>();`:

```csharp
    public DbSet<Banner> Banners => Set<Banner>();
    public DbSet<Poster> Posters => Set<Poster>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<SupportTicketMessage>(m => { ... });` block:

```csharp
        modelBuilder.Entity<Banner>(b =>
        {
            b.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            b.HasIndex(x => x.TenantId);
            b.Property(x => x.ImageUrl).HasMaxLength(2000);
            b.Property(x => x.WatermarkTitle).HasMaxLength(200);
        });

        modelBuilder.Entity<Poster>(p =>
        {
            p.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            p.HasIndex(x => x.TenantId);
            p.Property(x => x.Type).HasMaxLength(100);
        });
```

- [ ] **Step 3: Create the DTOs**

`services/directory-api/DirectoryApi/Dtos/BannerDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace DirectoryApi.Dtos;

public class CreateBannerRequest
{
    [Required, MaxLength(2000)]
    public required string ImageUrl { get; set; }

    [Required, MaxLength(200)]
    public required string WatermarkTitle { get; set; }
}

public class UpdateBannerRequest : CreateBannerRequest
{
}

public class BannerResponse
{
    public Guid Id { get; set; }
    public required string ImageUrl { get; set; }
    public required string WatermarkTitle { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

`services/directory-api/DirectoryApi/Dtos/PosterDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreatePosterRequest
{
    [Required, MaxLength(100)]
    public required string Type { get; set; }

    [Required]
    public PosterPosition? Position { get; set; }

    [Required]
    public DateOnly? ActiveFrom { get; set; }

    [Required]
    public DateOnly? ActiveTo { get; set; }

    public int Priority { get; set; }

    public bool IsActive { get; set; }
}

public class UpdatePosterRequest : CreatePosterRequest
{
}

public class PosterResponse
{
    public Guid Id { get; set; }
    public required string Type { get; set; }
    public PosterPosition Position { get; set; }
    public DateOnly ActiveFrom { get; set; }
    public DateOnly ActiveTo { get; set; }
    public int Priority { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 4: Implement the Banner endpoints**

`services/directory-api/DirectoryApi/Endpoints/BannerEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class BannerEndpoints
{
    public static void MapBannerEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/banners");

        group.MapGet("", async (int? page, int? pageSize, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Banners.OrderByDescending(b => b.CreatedAt).ThenBy(b => b.Id);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<BannerResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var banner = await db.Banners.FirstOrDefaultAsync(b => b.Id == id);
            return banner is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Banner not found")
                : Results.Ok(ToResponse(banner));
        });

        group.MapPost("", async (CreateBannerRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var banner = new Banner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ImageUrl = request.ImageUrl,
                WatermarkTitle = request.WatermarkTitle,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.Banners.Add(banner);
            await db.SaveChangesAsync();

            return Results.Created($"/banners/{banner.Id}", ToResponse(banner));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateBannerRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var banner = await db.Banners.FirstOrDefaultAsync(b => b.Id == id);
            if (banner is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Banner not found");
            }

            banner.ImageUrl = request.ImageUrl;
            banner.WatermarkTitle = request.WatermarkTitle;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(banner));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var banner = await db.Banners.FirstOrDefaultAsync(b => b.Id == id);
            if (banner is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Banner not found");
            }

            db.Banners.Remove(banner);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static BannerResponse ToResponse(Banner banner) => new()
    {
        Id = banner.Id,
        ImageUrl = banner.ImageUrl,
        WatermarkTitle = banner.WatermarkTitle,
        CreatedAt = banner.CreatedAt
    };
}
```

- [ ] **Step 5: Implement the Poster endpoints**

`services/directory-api/DirectoryApi/Endpoints/PosterEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class PosterEndpoints
{
    public static void MapPosterEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/posters");

        group.MapGet("", async (int? page, int? pageSize, bool? isActive, PosterPosition? position, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Posters.AsQueryable();
            if (isActive is not null)
            {
                query = query.Where(p => p.IsActive == isActive.Value);
            }
            if (position is not null)
            {
                query = query.Where(p => p.Position == position.Value);
            }
            query = query.OrderByDescending(p => p.Priority).ThenByDescending(p => p.CreatedAt).ThenBy(p => p.Id);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<PosterResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var poster = await db.Posters.FirstOrDefaultAsync(p => p.Id == id);
            return poster is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Poster not found")
                : Results.Ok(ToResponse(poster));
        });

        group.MapPost("", async (CreatePosterRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var poster = new Poster
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Type = request.Type,
                Position = request.Position!.Value,
                ActiveFrom = request.ActiveFrom!.Value,
                ActiveTo = request.ActiveTo!.Value,
                Priority = request.Priority,
                IsActive = request.IsActive,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.Posters.Add(poster);
            await db.SaveChangesAsync();

            return Results.Created($"/posters/{poster.Id}", ToResponse(poster));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdatePosterRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var poster = await db.Posters.FirstOrDefaultAsync(p => p.Id == id);
            if (poster is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Poster not found");
            }

            poster.Type = request.Type;
            poster.Position = request.Position!.Value;
            poster.ActiveFrom = request.ActiveFrom!.Value;
            poster.ActiveTo = request.ActiveTo!.Value;
            poster.Priority = request.Priority;
            poster.IsActive = request.IsActive;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(poster));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var poster = await db.Posters.FirstOrDefaultAsync(p => p.Id == id);
            if (poster is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Poster not found");
            }

            db.Posters.Remove(poster);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static PosterResponse ToResponse(Poster poster) => new()
    {
        Id = poster.Id,
        Type = poster.Type,
        Position = poster.Position,
        ActiveFrom = poster.ActiveFrom,
        ActiveTo = poster.ActiveTo,
        Priority = poster.Priority,
        IsActive = poster.IsActive,
        CreatedAt = poster.CreatedAt
    };
}
```

- [ ] **Step 6: Wire the endpoints into `Program.cs`**

In `services/directory-api/DirectoryApi/Program.cs`, add these two lines right after the existing `app.MapSupportTicketEndpoints();` line:

```csharp
app.MapBannerEndpoints();
app.MapPosterEndpoints();
```

- [ ] **Step 7: Generate the migration**

```bash
cd services/directory-api/DirectoryApi
dotnet ef migrations add AddBannerAndPoster --output-dir Migrations
cd ../../..
```

- [ ] **Step 8: Build and run the existing test suite as a regression check**

Run: `dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: 71/71 passing, unchanged.

- [ ] **Step 9: Commit**

```bash
git add services/directory-api/DirectoryApi/Entities/Banner.cs services/directory-api/DirectoryApi/Entities/Poster.cs services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs services/directory-api/DirectoryApi/Dtos/BannerDtos.cs services/directory-api/DirectoryApi/Dtos/PosterDtos.cs services/directory-api/DirectoryApi/Endpoints/BannerEndpoints.cs services/directory-api/DirectoryApi/Endpoints/PosterEndpoints.cs services/directory-api/DirectoryApi/Program.cs services/directory-api/DirectoryApi/Migrations
git commit -m "feat(directory-api): add Banner and Poster CRUD (tests deferred to later pass)"
```

---

### Task 2: `AppVersion` (platform-scoped)

**Files:**
- Create: `services/directory-api/DirectoryApi/Entities/AppVersion.cs`
- Modify: `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/AppVersionDtos.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/AppVersionEndpoints.cs`
- Modify: `services/directory-api/DirectoryApi/Program.cs`
- Create: `services/directory-api/DirectoryApi/Migrations/*`

**Interfaces:**
- Produces: `POST/GET /app-versions`, `GET/PUT /app-versions/{id}`.

- [ ] **Step 1: Create the entity**

`services/directory-api/DirectoryApi/Entities/AppVersion.cs`:

```csharp
namespace DirectoryApi.Entities;

public enum TargetApp
{
    AdminSpa,
    ParentApp,
    StaffApp
}

public enum ReleaseStatus
{
    Draft,
    Published,
    Deprecated
}

// Platform-scoped, deliberately -- no TenantId. One Admin SPA / one set of mobile app binaries
// serves every tenant, so a version record duplicated per tenant would be meaningless. Modeled
// exactly like the existing Tenant entity (see design spec §1).
public class AppVersion
{
    public Guid Id { get; set; }
    public TargetApp TargetApp { get; set; }
    public required string VersionNumber { get; set; }
    public ReleaseStatus ReleaseStatus { get; set; }
    public bool RequireUpdate { get; set; }
    public DateOnly ReleaseDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 2: Register the entity in the DbContext (no query filter)**

Modify `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`. Add this line right after the existing `public DbSet<Poster> Posters => Set<Poster>();` (added in Task 1):

```csharp
    public DbSet<AppVersion> AppVersions => Set<AppVersion>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<Poster>(p => { ... });` block. **Note there is no `HasQueryFilter` call here — this is deliberate, matching the existing `modelBuilder.Entity<Tenant>(...)` block just above it in the same file, which also has no query filter:**

```csharp
        modelBuilder.Entity<AppVersion>(a =>
        {
            a.Property(x => x.VersionNumber).HasMaxLength(50);
        });
```

- [ ] **Step 3: Create the DTOs**

`services/directory-api/DirectoryApi/Dtos/AppVersionDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateAppVersionRequest
{
    [Required]
    public TargetApp? TargetApp { get; set; }

    [Required, MaxLength(50)]
    public required string VersionNumber { get; set; }

    [Required]
    public ReleaseStatus? ReleaseStatus { get; set; }

    public bool RequireUpdate { get; set; }

    [Required]
    public DateOnly? ReleaseDate { get; set; }
}

public class UpdateAppVersionRequest : CreateAppVersionRequest
{
}

public class AppVersionResponse
{
    public Guid Id { get; set; }
    public TargetApp TargetApp { get; set; }
    public required string VersionNumber { get; set; }
    public ReleaseStatus ReleaseStatus { get; set; }
    public bool RequireUpdate { get; set; }
    public DateOnly ReleaseDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 4: Implement the endpoints**

`services/directory-api/DirectoryApi/Endpoints/AppVersionEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

// SECURITY: platform-scoped, same caveat as TenantEndpoints.cs -- no user identity system exists
// yet, so these endpoints are intentionally unauthenticated. Anyone with a valid X-Tenant-Id can
// read/write every tenant's shared app-version records (there's only one set, platform-wide).
// Do NOT expose this service publicly until real Auth0 authorization is wired up.
public static class AppVersionEndpoints
{
    public static void MapAppVersionEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/app-versions");

        group.MapGet("", async (int? page, int? pageSize, TargetApp? targetApp, ReleaseStatus? releaseStatus, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.AppVersions.AsQueryable();
            if (targetApp is not null)
            {
                query = query.Where(a => a.TargetApp == targetApp.Value);
            }
            if (releaseStatus is not null)
            {
                query = query.Where(a => a.ReleaseStatus == releaseStatus.Value);
            }
            query = query.OrderByDescending(a => a.ReleaseDate).ThenBy(a => a.Id);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<AppVersionResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var appVersion = await db.AppVersions.FirstOrDefaultAsync(a => a.Id == id);
            return appVersion is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "App version not found")
                : Results.Ok(ToResponse(appVersion));
        });

        group.MapPost("", async (CreateAppVersionRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var appVersion = new AppVersion
            {
                Id = Guid.NewGuid(),
                TargetApp = request.TargetApp!.Value,
                VersionNumber = request.VersionNumber,
                ReleaseStatus = request.ReleaseStatus!.Value,
                RequireUpdate = request.RequireUpdate,
                ReleaseDate = request.ReleaseDate!.Value,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.AppVersions.Add(appVersion);
            await db.SaveChangesAsync();

            return Results.Created($"/app-versions/{appVersion.Id}", ToResponse(appVersion));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateAppVersionRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var appVersion = await db.AppVersions.FirstOrDefaultAsync(a => a.Id == id);
            if (appVersion is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "App version not found");
            }

            appVersion.TargetApp = request.TargetApp!.Value;
            appVersion.VersionNumber = request.VersionNumber;
            appVersion.ReleaseStatus = request.ReleaseStatus!.Value;
            appVersion.RequireUpdate = request.RequireUpdate;
            appVersion.ReleaseDate = request.ReleaseDate!.Value;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(appVersion));
        });
    }

    private static AppVersionResponse ToResponse(AppVersion appVersion) => new()
    {
        Id = appVersion.Id,
        TargetApp = appVersion.TargetApp,
        VersionNumber = appVersion.VersionNumber,
        ReleaseStatus = appVersion.ReleaseStatus,
        RequireUpdate = appVersion.RequireUpdate,
        ReleaseDate = appVersion.ReleaseDate,
        CreatedAt = appVersion.CreatedAt
    };
}
```

- [ ] **Step 5: Wire the endpoints into `Program.cs`**

In `services/directory-api/DirectoryApi/Program.cs`, add this line right after the existing `app.MapPosterEndpoints();` line (added in Task 1):

```csharp
app.MapAppVersionEndpoints();
```

- [ ] **Step 6: Generate the migration**

```bash
cd services/directory-api/DirectoryApi
dotnet ef migrations add AddAppVersion --output-dir Migrations
cd ../../..
```

- [ ] **Step 7: Build and run the existing test suite as a regression check**

Run: `dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: 71/71 passing, unchanged.

- [ ] **Step 8: Commit**

```bash
git add services/directory-api/DirectoryApi/Entities/AppVersion.cs services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs services/directory-api/DirectoryApi/Dtos/AppVersionDtos.cs services/directory-api/DirectoryApi/Endpoints/AppVersionEndpoints.cs services/directory-api/DirectoryApi/Program.cs services/directory-api/DirectoryApi/Migrations
git commit -m "feat(directory-api): add platform-scoped AppVersion CRUD (tests deferred to later pass)"
```

---

## Definition of done for this plan

- [ ] `dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj` succeeds with 0 errors
- [ ] `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj` — 71/71 passing, unchanged
- [ ] `AppVersion` has no `TenantId` column and no query filter, confirmed in the migration and `DirectoryDbContext`
- [ ] Both commits from this plan are present in `git log`
- [ ] **Test coverage for this sub-project remains outstanding** — tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier
- [ ] Phase 4's remaining pieces (Admin User Management, Tenant billing/onboarding) stay explicitly deferred, tracked in `DEFERRED-AND-TODO.md`
