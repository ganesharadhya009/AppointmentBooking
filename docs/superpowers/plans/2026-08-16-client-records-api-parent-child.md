# Client & Child Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full CRUD on `/parents` and `/children` to the `ClientRecordsApi` service — currently just a health-check skeleton — with tenant isolation on both entities from day one.

**Architecture:** A fresh `ClientRecordsDbContext` (this service has its own database, separate from `DirectoryApi`'s) with EF Core global query filters on BOTH `Parent` and `Child` — unlike `DirectoryApi`'s original Branch/TherapyType design, `Child` does not rely on navigation-only isolation through `Parent`, because it's queried as an independent top-level resource (see design spec §3). Same `X-Tenant-Id` header stub, RFC 7807 errors, and `DataAnnotationsValidator` pattern as `DirectoryApi` — re-implemented fresh in this service, not shared code (separate services, separate deployables).

**Tech Stack:** .NET 9, EF Core 9.0.19 (same packages as `DirectoryApi`, `dotnet-ef` already available via the repo-root `.config/dotnet-tools.json` manifest — no new tool install needed), SQL Server LocalDB for tests.

## Global Constraints

- No new NuGet packages beyond what `DirectoryApi` already uses: `Microsoft.EntityFrameworkCore.SqlServer` and `Microsoft.EntityFrameworkCore.Design`, both pinned to **9.0.19**.
- Both `Parent` and `Child` are tenant-scoped: EF Core query filter + `HasIndex(TenantId)` on both, from the first migration — not retrofitted later.
- `Child.ParentId` must resolve to a `Parent` in the same tenant — rejected with `ValidationProblem` on create/update if not, never silently dropped.
- No password/login field on `Parent`.
- Neither entity supports hard delete — `DELETE` sets `Status = Inactive` on both.
- Every error response is RFC 7807 via `Results.Problem(...)` / `Results.ValidationProblem(...)`.
- `CreatedBy` hardcoded to `"system"` (no user identity yet, matching the rest of the platform).
- List endpoints return `{ items, page, pageSize, totalCount }`, default `pageSize=20`, max `100`.
- **No explicit database transactions needed in this plan.** Unlike `DirectoryApi`'s Branch/Therapist PUT handlers (which replace an embedded child collection via two `SaveChangesAsync()` calls, requiring the `CreateExecutionStrategy().ExecuteAsync(...)` retry-safety pattern), every write in this plan is a single entity, single `SaveChangesAsync()` call — `EnableRetryOnFailure()` alone handles retry safety for that case with no extra wrapping. Do not add transaction/execution-strategy code that isn't needed here.

---

### Task 1: Data layer — entities, DbContext, tenancy, migration

**Files:**
- Modify: `services/client-records-api/ClientRecordsApi/ClientRecordsApi.csproj` (add EF Core packages)
- Create: `services/client-records-api/ClientRecordsApi/Entities/Parent.cs`
- Create: `services/client-records-api/ClientRecordsApi/Entities/Child.cs`
- Create: `services/client-records-api/ClientRecordsApi/Data/ClientRecordsDbContext.cs`
- Create: `services/client-records-api/ClientRecordsApi/Tenancy/ITenantContext.cs`
- Create: `services/client-records-api/ClientRecordsApi/Tenancy/TenantContext.cs`
- Create: `services/client-records-api/ClientRecordsApi/Tenancy/TenantIdMiddleware.cs`
- Modify: `services/client-records-api/ClientRecordsApi/Program.cs`
- Modify: `services/client-records-api/ClientRecordsApi/appsettings.Development.json`
- Create: `services/client-records-api/ClientRecordsApi/Migrations/*` (generated)
- Create: `services/client-records-api/ClientRecordsApi.Tests/Fixtures/LocalDbTestFixture.cs`
- Test: `services/client-records-api/ClientRecordsApi.Tests/DataLayerFoundationTests.cs`

**Interfaces:**
- Consumes: nothing new (builds on the Platform Foundation `ClientRecordsApi` skeleton's `Program.cs` and `public partial class Program`)
- Produces:
  - `ClientRecordsApi.Entities.Parent` (`Id`, `TenantId`, `Name`, `MobileNumber`, `Email`, `Address`, `City`, `State`, `Country`, `Status` enum: Active/Inactive, `CreatedAt`, `CreatedBy`)
  - `ClientRecordsApi.Entities.Child` (`Id`, `TenantId`, `ParentId`, `Name`, `DateOfBirth: DateOnly`, `Gender`, `GuardianName`, `Status` enum: Active/Inactive, `CreatedAt`, `CreatedBy`)
  - `ClientRecordsApi.Data.ClientRecordsDbContext` with `DbSet<Parent> Parents`, `DbSet<Child> Children`, both with tenant query filters
  - `ClientRecordsApi.Tenancy.ITenantContext`/`TenantContext`/`TenantIdMiddleware` (excludes only `/health` — there is no `/tenants`-equivalent bootstrapping endpoint in this service, so every real endpoint requires the header)
  - `ClientRecordsApi.Tests.Fixtures.LocalDbTestFixture : WebApplicationFactory<Program>, IAsyncLifetime`

- [ ] **Step 1: Add EF Core packages**

```bash
cd services/client-records-api/ClientRecordsApi
dotnet add package Microsoft.EntityFrameworkCore.SqlServer --version 9.0.19
dotnet add package Microsoft.EntityFrameworkCore.Design --version 9.0.19
cd ../../..
```

- [ ] **Step 2: Create the entity classes**

`services/client-records-api/ClientRecordsApi/Entities/Parent.cs`:

```csharp
namespace ClientRecordsApi.Entities;

public enum ClientStatus
{
    Active,
    Inactive
}

public class Parent
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public required string MobileNumber { get; set; }
    public required string Email { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public ClientStatus Status { get; set; } = ClientStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public required string CreatedBy { get; set; }
}
```

`services/client-records-api/ClientRecordsApi/Entities/Child.cs`:

```csharp
namespace ClientRecordsApi.Entities;

public class Child
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ParentId { get; set; }
    public required string Name { get; set; }
    public DateOnly DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? GuardianName { get; set; }
    public ClientStatus Status { get; set; } = ClientStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public required string CreatedBy { get; set; }
}
```

`ClientStatus` is shared by both entities and lives in `Parent.cs` (matching the codebase convention of defining a shared small enum alongside the first entity that needs it — see `TherapistStatus` living in `Therapist.cs` in the sibling `DirectoryApi` service).

- [ ] **Step 3: Create the tenancy types**

`services/client-records-api/ClientRecordsApi/Tenancy/ITenantContext.cs`:

```csharp
namespace ClientRecordsApi.Tenancy;

public interface ITenantContext
{
    Guid TenantId { get; }
}
```

`services/client-records-api/ClientRecordsApi/Tenancy/TenantContext.cs`:

```csharp
namespace ClientRecordsApi.Tenancy;

public class TenantContext : ITenantContext
{
    private Guid? _tenantId;

    public Guid TenantId => _tenantId ?? throw new InvalidOperationException(
        "TenantId was read before it was set. This should only happen for a request the tenant middleware didn't scope (e.g. /health) — those endpoints must not depend on ITenantContext.");

    public void Set(Guid tenantId)
    {
        _tenantId = tenantId;
    }
}
```

`services/client-records-api/ClientRecordsApi/Tenancy/TenantIdMiddleware.cs`:

```csharp
using Microsoft.AspNetCore.Http;

namespace ClientRecordsApi.Tenancy;

public class TenantIdMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, TenantContext tenantContext, IProblemDetailsService problemDetailsService)
    {
        if (context.Request.Path.Equals("/health", StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue) ||
            !Guid.TryParse(headerValue, out var tenantId) ||
            tenantId == Guid.Empty)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await problemDetailsService.WriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Missing or invalid X-Tenant-Id header",
                    Detail = "Every request except /health must include a valid, non-empty X-Tenant-Id header (a GUID)."
                }
            });
            return;
        }

        tenantContext.Set(tenantId);
        await next(context);
    }
}
```

This starts with the exact-path-match and `Guid.Empty` rejection already learned in `DirectoryApi`'s final review — no separate hardening pass needed here.

- [ ] **Step 4: Create the DbContext with tenant query filters on both entities**

`services/client-records-api/ClientRecordsApi/Data/ClientRecordsDbContext.cs`:

```csharp
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ClientRecordsApi.Data;

public class ClientRecordsDbContext(DbContextOptions<ClientRecordsDbContext> options, ITenantContext tenantContext)
    : DbContext(options)
{
    public DbSet<Parent> Parents => Set<Parent>();
    public DbSet<Child> Children => Set<Child>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Parent>(p =>
        {
            p.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            p.HasIndex(x => x.TenantId);
            p.Property(x => x.Name).HasMaxLength(200);
            p.Property(x => x.MobileNumber).HasMaxLength(20);
            p.Property(x => x.Email).HasMaxLength(200);
            p.Property(x => x.Address).HasMaxLength(500);
            p.Property(x => x.City).HasMaxLength(100);
            p.Property(x => x.State).HasMaxLength(100);
            p.Property(x => x.Country).HasMaxLength(100);
        });

        modelBuilder.Entity<Child>(c =>
        {
            c.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            c.HasIndex(x => x.TenantId);
            c.HasIndex(x => x.ParentId);
            c.Property(x => x.Name).HasMaxLength(200);
            c.Property(x => x.Gender).HasMaxLength(20);
            c.Property(x => x.GuardianName).HasMaxLength(200);
        });
    }
}
```

Note: `Child.ParentId` is a plain `Guid` column with no EF-configured foreign key to `Parent` (no navigation property) — validity is checked at the application layer in Task 3, the same pattern `DirectoryApi` uses for `TherapistAssignment.BranchId`/`TherapyTypeId`.

- [ ] **Step 5: Wire everything into `Program.cs`**

Replace the full contents of `services/client-records-api/ClientRecordsApi/Program.cs`:

```csharp
using ClientRecordsApi.Data;
using ClientRecordsApi.Tenancy;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddDbContext<ClientRecordsDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("ClientRecordsDb"), sqlOptions => sqlOptions.EnableRetryOnFailure()));
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ClientRecordsDbContext>();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        db.Database.Migrate();
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseMiddleware<TenantIdMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "ClientRecordsApi" }));

app.Run();

public partial class Program { }
```

- [ ] **Step 6: Add the LocalDB connection string**

Read `services/client-records-api/ClientRecordsApi/appsettings.Development.json` first, then replace its full contents with:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "ClientRecordsDb": "Server=(localdb)\\MSSQLLocalDB;Database=ClientRecordsApi_Dev;Trusted_Connection=True;TrustServerCertificate=True;"
  }
}
```

- [ ] **Step 7: Create the LocalDB test fixture**

`services/client-records-api/ClientRecordsApi.Tests/Fixtures/LocalDbTestFixture.cs`:

```csharp
using ClientRecordsApi.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ClientRecordsApi.Tests.Fixtures;

public class LocalDbTestFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _databaseName = $"ClientRecordsApiTest_{Guid.NewGuid():N}";

    public string ConnectionString =>
        $"Server=(localdb)\\MSSQLLocalDB;Database={_databaseName};Trusted_Connection=True;TrustServerCertificate=True;";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:ClientRecordsDb"] = ConnectionString
            });
        });
    }

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClientRecordsDbContext>();
        await db.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClientRecordsDbContext>();
        await db.Database.EnsureDeletedAsync();
        await base.DisposeAsync();
    }
}
```

- [ ] **Step 8: Write a proof-of-life test**

`services/client-records-api/ClientRecordsApi.Tests/DataLayerFoundationTests.cs`:

```csharp
using ClientRecordsApi.Data;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tests.Fixtures;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ClientRecordsApi.Tests;

public class DataLayerFoundationTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;

    public DataLayerFoundationTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CanInsertAndRetrieveAParentAndChild_ThroughMigratedLocalDb()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClientRecordsDbContext>();

        var parent = new Parent
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Name = "Test Parent",
            MobileNumber = "9999999999",
            Email = "parent@example.com",
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = "system"
        };
        var child = new Child
        {
            Id = Guid.NewGuid(),
            TenantId = parent.TenantId,
            ParentId = parent.Id,
            Name = "Test Child",
            DateOfBirth = new DateOnly(2018, 1, 1),
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = "system"
        };

        db.Parents.Add(parent);
        db.Children.Add(child);
        await db.SaveChangesAsync();

        using var readScope = _fixture.Services.CreateScope();
        var readDb = readScope.ServiceProvider.GetRequiredService<ClientRecordsDbContext>();
        var foundParent = await readDb.Parents.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == parent.Id);
        var foundChild = await readDb.Children.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == child.Id);

        Assert.NotNull(foundParent);
        Assert.Equal("Test Parent", foundParent!.Name);
        Assert.NotNull(foundChild);
        Assert.Equal(parent.Id, foundChild!.ParentId);
    }

    [Fact]
    public async Task HealthEndpoint_StillWorks_WithFullDataLayerWired()
    {
        var client = _fixture.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }
}
```

`IgnoreQueryFilters()` is required here for the same reason it was in `DirectoryApi`'s equivalent test: both `Parent` and `Child` have query filters, and this test resolves a DbContext outside any HTTP request, so `ITenantContext.TenantId` was never `Set()`.

- [ ] **Step 9: Generate the initial migration**

```bash
cd services/client-records-api/ClientRecordsApi
dotnet ef migrations add InitialCreate --output-dir Migrations
cd ../../..
```

- [ ] **Step 10: Run the tests and verify they pass**

Run: `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj`
Expected: `Passed! - Failed: 0, Passed: 3` — a pre-existing `HealthEndpointTests.cs` from Platform Foundation (1 test) plus the two new tests in this step.

- [ ] **Step 11: Commit**

```bash
git add services/client-records-api/ClientRecordsApi services/client-records-api/ClientRecordsApi.Tests
git commit -m "feat(client-records-api): add Parent/Child data layer with tenant isolation on both entities"
```

---

### Task 2: Parent endpoints (full CRUD)

**Files:**
- Create: `services/client-records-api/ClientRecordsApi/Common/PagedResult.cs`
- Create: `services/client-records-api/ClientRecordsApi/Validation/DataAnnotationsValidator.cs`
- Create: `services/client-records-api/ClientRecordsApi/Dtos/ParentDtos.cs`
- Create: `services/client-records-api/ClientRecordsApi/Endpoints/ParentEndpoints.cs`
- Modify: `services/client-records-api/ClientRecordsApi/Program.cs`
- Test: `services/client-records-api/ClientRecordsApi.Tests/ParentEndpointsTests.cs`

**Interfaces:**
- Consumes: `ClientRecordsDbContext`, `ITenantContext` (Task 1), `LocalDbTestFixture` (Task 1)
- Produces:
  - `ClientRecordsApi.Common.PagedResult<T>` (`Items`, `Page`, `PageSize`, `TotalCount`) — reused by Task 3
  - `ClientRecordsApi.Validation.DataAnnotationsValidator.Validate(object): Dictionary<string, string[]>?` — reused by Task 3
  - full CRUD on `/parents`

- [ ] **Step 1: Create the shared pagination envelope**

`services/client-records-api/ClientRecordsApi/Common/PagedResult.cs`:

```csharp
namespace ClientRecordsApi.Common;

public class PagedResult<T>
{
    public required List<T> Items { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}
```

- [ ] **Step 2: Create the DataAnnotations validator**

`services/client-records-api/ClientRecordsApi/Validation/DataAnnotationsValidator.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace ClientRecordsApi.Validation;

public static class DataAnnotationsValidator
{
    public static Dictionary<string, string[]>? Validate(object request)
    {
        var context = new ValidationContext(request);
        var results = new List<ValidationResult>();

        if (Validator.TryValidateObject(request, context, results, validateAllProperties: true))
        {
            return null;
        }

        return results
            .SelectMany(r => r.MemberNames.DefaultIfEmpty(""), (r, member) => (member, r.ErrorMessage))
            .GroupBy(x => x.member)
            .ToDictionary(g => g.Key, g => g.Select(x => x.ErrorMessage ?? "Invalid value.").ToArray());
    }
}
```

- [ ] **Step 3: Create the Parent DTOs**

`services/client-records-api/ClientRecordsApi/Dtos/ParentDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using ClientRecordsApi.Entities;

namespace ClientRecordsApi.Dtos;

public class CreateParentRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required, MaxLength(20)]
    public required string MobileNumber { get; set; }

    [Required, MaxLength(200)]
    public required string Email { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }
}

public class UpdateParentRequest : CreateParentRequest
{
    [Required]
    public ClientStatus Status { get; set; }
}

public class ParentResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string MobileNumber { get; set; }
    public required string Email { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public ClientStatus Status { get; set; }
}
```

- [ ] **Step 4: Write the failing tests**

`services/client-records-api/ClientRecordsApi.Tests/ParentEndpointsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using ClientRecordsApi.Common;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tests.Fixtures;
using Xunit;

namespace ClientRecordsApi.Tests;

public class ParentEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ParentEndpointsTests(LocalDbTestFixture fixture)
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
    public async Task PostThenGetParent_RoundTripsCorrectly()
    {
        var tenantId = Guid.NewGuid();

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantId, new CreateParentRequest
        {
            Name = "Jane Doe",
            MobileNumber = "9876543210",
            Email = "jane@example.com",
            City = "Bengaluru"
        }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var createdBody = await created.Content.ReadFromJsonAsync<ParentResponse>();

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/parents/{createdBody!.Id}", tenantId));

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<ParentResponse>();
        Assert.Equal("Jane Doe", fetchedBody!.Name);
        Assert.Equal(ClientStatus.Active, fetchedBody.Status);
    }

    [Fact]
    public async Task PostParent_WithoutTenantHeader_Returns400ProblemDetails()
    {
        var response = await _client.PostAsJsonAsync("/parents", new CreateParentRequest
        {
            Name = "No Header Parent",
            MobileNumber = "9876543210",
            Email = "noheader@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task PostParent_WithMissingRequiredField_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantId, new { Name = "Incomplete" }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteParent_SetsInactive_RowStaysListed()
    {
        var tenantId = Guid.NewGuid();

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantId, new CreateParentRequest
        {
            Name = "To Deactivate",
            MobileNumber = "9876543210",
            Email = "deactivate@example.com"
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ParentResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/parents/{createdBody!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/parents/{createdBody.Id}", tenantId));
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<ParentResponse>();

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        Assert.Equal(ClientStatus.Inactive, fetchedBody!.Status);
    }

    [Fact]
    public async Task GetParentById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantA, new CreateParentRequest
        {
            Name = "Tenant A Only Parent",
            MobileNumber = "9876543210",
            Email = "tenanta@example.com"
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ParentResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/parents/{createdBody!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListParents_NeverReturnsAnotherTenantsParents()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantA, new CreateParentRequest
        {
            Name = "Tenant A Parent",
            MobileNumber = "9876543210",
            Email = "a@example.com"
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantB, new CreateParentRequest
        {
            Name = "Tenant B Parent",
            MobileNumber = "9876543210",
            Email = "b@example.com"
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/parents", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ParentResponse>>();

        Assert.All(body!.Items, p => Assert.NotEqual("Tenant B Parent", p.Name));
        Assert.Contains(body.Items, p => p.Name == "Tenant A Parent");
    }
}
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj --filter ParentEndpointsTests`
Expected: FAIL — no `/parents` route mapped yet

- [ ] **Step 6: Implement the Parent endpoints**

`services/client-records-api/ClientRecordsApi/Endpoints/ParentEndpoints.cs`:

```csharp
using ClientRecordsApi.Common;
using ClientRecordsApi.Data;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tenancy;
using ClientRecordsApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace ClientRecordsApi.Endpoints;

public static class ParentEndpoints
{
    public static void MapParentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/parents");

        group.MapGet("", async (int? page, int? pageSize, ClientRecordsDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Parents.OrderBy(p => p.Name);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ParentResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var parent = await db.Parents.FirstOrDefaultAsync(p => p.Id == id);
            return parent is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Parent not found")
                : Results.Ok(ToResponse(parent));
        });

        group.MapPost("", async (CreateParentRequest request, ClientRecordsDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var parent = new Parent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                MobileNumber = request.MobileNumber,
                Email = request.Email,
                Address = request.Address,
                City = request.City,
                State = request.State,
                Country = request.Country,
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            db.Parents.Add(parent);
            await db.SaveChangesAsync();

            return Results.Created($"/parents/{parent.Id}", ToResponse(parent));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateParentRequest request, ClientRecordsDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var parent = await db.Parents.FirstOrDefaultAsync(p => p.Id == id);
            if (parent is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Parent not found");
            }

            parent.Name = request.Name;
            parent.MobileNumber = request.MobileNumber;
            parent.Email = request.Email;
            parent.Address = request.Address;
            parent.City = request.City;
            parent.State = request.State;
            parent.Country = request.Country;
            parent.Status = request.Status;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(parent));
        });

        group.MapDelete("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var parent = await db.Parents.FirstOrDefaultAsync(p => p.Id == id);
            if (parent is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Parent not found");
            }

            parent.Status = ClientStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ParentResponse ToResponse(Parent parent) => new()
    {
        Id = parent.Id,
        Name = parent.Name,
        MobileNumber = parent.MobileNumber,
        Email = parent.Email,
        Address = parent.Address,
        City = parent.City,
        State = parent.State,
        Country = parent.Country,
        Status = parent.Status
    };
}
```

- [ ] **Step 7: Map the endpoints in `Program.cs`**

Add `using ClientRecordsApi.Endpoints;` to the top of `services/client-records-api/ClientRecordsApi/Program.cs`, and add this line right after the existing `app.MapGet("/health", ...)` line:

```csharp
app.MapParentEndpoints();
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total over predicted arithmetic (3 from Task 1 + 6 new).

- [ ] **Step 9: Commit**

```bash
git add services/client-records-api/ClientRecordsApi services/client-records-api/ClientRecordsApi.Tests
git commit -m "feat(client-records-api): add parent CRUD endpoints"
```

---

### Task 3: Child endpoints (full CRUD, cross-tenant ParentId validation)

**Files:**
- Create: `services/client-records-api/ClientRecordsApi/Dtos/ChildDtos.cs`
- Create: `services/client-records-api/ClientRecordsApi/Endpoints/ChildEndpoints.cs`
- Modify: `services/client-records-api/ClientRecordsApi/Program.cs`
- Test: `services/client-records-api/ClientRecordsApi.Tests/ChildEndpointsTests.cs`

**Interfaces:**
- Consumes: `ClientRecordsDbContext`, `ITenantContext`, `PagedResult<T>`, `DataAnnotationsValidator.Validate` (Task 2), `Parent` entity (Task 1)
- Produces: full CRUD on `/children`

- [ ] **Step 1: Create the Child DTOs**

`services/client-records-api/ClientRecordsApi/Dtos/ChildDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using ClientRecordsApi.Entities;

namespace ClientRecordsApi.Dtos;

public class CreateChildRequest
{
    [Required]
    public Guid ParentId { get; set; }

    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required]
    public DateOnly DateOfBirth { get; set; }

    [MaxLength(20)]
    public string? Gender { get; set; }

    [MaxLength(200)]
    public string? GuardianName { get; set; }
}

public class UpdateChildRequest : CreateChildRequest
{
    [Required]
    public ClientStatus Status { get; set; }
}

public class ChildResponse
{
    public Guid Id { get; set; }
    public Guid ParentId { get; set; }
    public required string Name { get; set; }
    public DateOnly DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? GuardianName { get; set; }
    public ClientStatus Status { get; set; }
}
```

- [ ] **Step 2: Write the failing tests**

`services/client-records-api/ClientRecordsApi.Tests/ChildEndpointsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using ClientRecordsApi.Common;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tests.Fixtures;
using Xunit;

namespace ClientRecordsApi.Tests;

public class ChildEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ChildEndpointsTests(LocalDbTestFixture fixture)
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

    private async Task<Guid> CreateParentAsync(Guid tenantId)
    {
        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantId, new CreateParentRequest
        {
            Name = "Test Parent For Child",
            MobileNumber = "9876543210",
            Email = $"{Guid.NewGuid():N}@example.com"
        }));
        var body = await response.Content.ReadFromJsonAsync<ParentResponse>();
        return body!.Id;
    }

    [Fact]
    public async Task PostThenGetChild_RoundTripsCorrectly()
    {
        var tenantId = Guid.NewGuid();
        var parentId = await CreateParentAsync(tenantId);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantId, new CreateChildRequest
        {
            ParentId = parentId,
            Name = "Test Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var createdBody = await created.Content.ReadFromJsonAsync<ChildResponse>();

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/children/{createdBody!.Id}", tenantId));

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<ChildResponse>();
        Assert.Equal("Test Child", fetchedBody!.Name);
        Assert.Equal(parentId, fetchedBody.ParentId);
    }

    [Fact]
    public async Task PostChild_WithCrossTenantParent_ReturnsValidationProblem()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var parentIdOfTenantB = await CreateParentAsync(tenantB);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantA, new CreateChildRequest
        {
            ParentId = parentIdOfTenantB,
            Name = "Cross Tenant Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostChild_WithUnknownParentId_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantId, new CreateChildRequest
        {
            ParentId = Guid.NewGuid(),
            Name = "Orphan Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteChild_SetsInactive_RowStaysListed()
    {
        var tenantId = Guid.NewGuid();
        var parentId = await CreateParentAsync(tenantId);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantId, new CreateChildRequest
        {
            ParentId = parentId,
            Name = "To Deactivate",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ChildResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/children/{createdBody!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/children/{createdBody.Id}", tenantId));
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<ChildResponse>();

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        Assert.Equal(ClientStatus.Inactive, fetchedBody!.Status);
    }

    [Fact]
    public async Task GetChildById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var parentId = await CreateParentAsync(tenantA);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantA, new CreateChildRequest
        {
            ParentId = parentId,
            Name = "Tenant A Only Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ChildResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/children/{createdBody!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListChildren_NeverReturnsAnotherTenantsChildren()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var parentIdA = await CreateParentAsync(tenantA);
        var parentIdB = await CreateParentAsync(tenantB);

        await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantA, new CreateChildRequest
        {
            ParentId = parentIdA,
            Name = "Tenant A Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantB, new CreateChildRequest
        {
            ParentId = parentIdB,
            Name = "Tenant B Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/children", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ChildResponse>>();

        Assert.All(body!.Items, c => Assert.NotEqual("Tenant B Child", c.Name));
        Assert.Contains(body.Items, c => c.Name == "Tenant A Child");
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj --filter ChildEndpointsTests`
Expected: FAIL — no `/children` route mapped yet

- [ ] **Step 4: Implement the Child endpoints**

`services/client-records-api/ClientRecordsApi/Endpoints/ChildEndpoints.cs`:

```csharp
using ClientRecordsApi.Common;
using ClientRecordsApi.Data;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tenancy;
using ClientRecordsApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace ClientRecordsApi.Endpoints;

public static class ChildEndpoints
{
    public static void MapChildEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/children");

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

        group.MapGet("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var child = await db.Children.FirstOrDefaultAsync(c => c.Id == id);
            return child is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Child not found")
                : Results.Ok(ToResponse(child));
        });

        group.MapPost("", async (CreateChildRequest request, ClientRecordsDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var parentExists = await db.Parents.AnyAsync(p => p.Id == request.ParentId);
            if (!parentExists)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["parentId"] = ["The parent ID was not found or does not belong to this tenant."]
                });
            }

            var child = new Child
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ParentId = request.ParentId,
                Name = request.Name,
                DateOfBirth = request.DateOfBirth,
                Gender = request.Gender,
                GuardianName = request.GuardianName,
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            db.Children.Add(child);
            await db.SaveChangesAsync();

            return Results.Created($"/children/{child.Id}", ToResponse(child));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateChildRequest request, ClientRecordsDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var parentExists = await db.Parents.AnyAsync(p => p.Id == request.ParentId);
            if (!parentExists)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["parentId"] = ["The parent ID was not found or does not belong to this tenant."]
                });
            }

            var child = await db.Children.FirstOrDefaultAsync(c => c.Id == id);
            if (child is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Child not found");
            }

            child.ParentId = request.ParentId;
            child.Name = request.Name;
            child.DateOfBirth = request.DateOfBirth;
            child.Gender = request.Gender;
            child.GuardianName = request.GuardianName;
            child.Status = request.Status;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(child));
        });

        group.MapDelete("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var child = await db.Children.FirstOrDefaultAsync(c => c.Id == id);
            if (child is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Child not found");
            }

            child.Status = ClientStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ChildResponse ToResponse(Child child) => new()
    {
        Id = child.Id,
        ParentId = child.ParentId,
        Name = child.Name,
        DateOfBirth = child.DateOfBirth,
        Gender = child.Gender,
        GuardianName = child.GuardianName,
        Status = child.Status
    };
}
```

`db.Parents.AnyAsync(p => p.Id == request.ParentId)` relies on `Parent`'s tenant query filter to reject a cross-tenant `ParentId` — a parent belonging to a different tenant simply won't match, the same pattern `DirectoryApi` uses for Branch/TherapyType reference validation.

- [ ] **Step 5: Map the endpoints in `Program.cs`**

Add this line in `services/client-records-api/ClientRecordsApi/Program.cs`, right after `app.MapParentEndpoints();`:

```csharp
app.MapChildEndpoints();
```

- [ ] **Step 6: Run the full test suite and verify everything passes**

Run: `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total (3 from Task 1 + 6 from Task 2 + 6 new = 15).

- [ ] **Step 7: Commit**

```bash
git add services/client-records-api/ClientRecordsApi services/client-records-api/ClientRecordsApi.Tests
git commit -m "feat(client-records-api): add child CRUD endpoints with cross-tenant parent validation"
```

---

## Definition of done for this plan

- [ ] `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj` passes with 0 failures
- [ ] Every endpoint in design spec §5 exists and returns the documented status codes
- [ ] Tenant isolation verified by a passing integration test on both Parent and Child, by-ID and by-list
- [ ] Every commit from this plan is present in `git log`
