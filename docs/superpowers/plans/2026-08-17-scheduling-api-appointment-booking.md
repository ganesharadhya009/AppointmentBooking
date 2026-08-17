# Core Appointment Booking Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build full appointment booking on `SchedulingApi` — availability lookup, booking with idempotency, read/list, reschedule, cancel — including this codebase's first live cross-service HTTP calls to `DirectoryApi` and `ClientRecordsApi`.

**Architecture:** A fresh `SchedulingDbContext` (own database) with one tenant-scoped entity, `Appointment`. Cross-service reference validation goes through `IDirectoryApiClient`/`IClientRecordsApiClient` — real `HttpClient`-based implementations in production, fakes swapped in via DI for tests, so `SchedulingApi`'s test suite never needs `DirectoryApi`/`ClientRecordsApi` actually running. The bookable unit is a therapist's session window (Morning/Noon/Afternoon/Evening) for a given date — not a subdivided time grid.

**Tech Stack:** .NET 9, EF Core 9.0.19 (already installed, no new packages), SQL Server LocalDB for tests, `System.Net.Http.Json` for the cross-service clients.

## Global Constraints

- `Appointment` is tenant-scoped: EF Core query filter + `HasIndex(TenantId)` from the first migration — the now-established convention.
- Every cross-service HTTP call forwards the same `X-Tenant-Id` header the inbound request carried — per the design's resolution of the tenant-auth prerequisite. Never invent a second tenancy mechanism.
- Downstream 404s/errors from `DirectoryApi`/`ClientRecordsApi` become a `400 ValidationProblem` from `SchedulingApi`, never an unhandled 500.
- `POST /appointments` requires an `Idempotency-Key` header; a retried request with the same key (scoped per tenant via the DB's compound unique index) returns the original booking, not a duplicate.
- One appointment per Branch + Therapist + TherapyType + `WindowName` + date (non-cancelled) — enforced before every create/reschedule write.
- Every error response is RFC 7807 via `Results.Problem(...)`/`Results.ValidationProblem(...)`.
- `BookedBy` hardcoded to `"system"` (no user identity yet, matching the rest of the platform).
- List endpoints return `{ items, page, pageSize, totalCount }`, default `pageSize=20`, max `100`.
- Cross-service client JSON deserialization MUST use `JsonSerializerDefaults.Web` explicitly (case-insensitive, camelCase) — every other service in this codebase serializes responses in ASP.NET Core's default camelCase, and `HttpClient.ReadFromJsonAsync<T>()` without explicit options defaults to case-SENSITIVE PascalCase matching, which would silently fail to deserialize every field. This is not optional — get it wrong and every cross-service call returns a `null`-filled object with no exception.
- Confirmed local dev ports (do not guess a different value): `DirectoryApi` → `http://localhost:5256`, `ClientRecordsApi` → `http://localhost:5084`.

---

### Task 1: Data layer — Appointment entity, tenancy, migration

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/SchedulingApi.csproj`
- Create: `services/scheduling-api/SchedulingApi/Entities/Appointment.cs`
- Create: `services/scheduling-api/SchedulingApi/Data/SchedulingDbContext.cs`
- Create: `services/scheduling-api/SchedulingApi/Tenancy/ITenantContext.cs`
- Create: `services/scheduling-api/SchedulingApi/Tenancy/TenantContext.cs`
- Create: `services/scheduling-api/SchedulingApi/Tenancy/TenantIdMiddleware.cs`
- Modify: `services/scheduling-api/SchedulingApi/Program.cs`
- Modify: `services/scheduling-api/SchedulingApi/appsettings.Development.json`
- Create: `services/scheduling-api/SchedulingApi/Migrations/*`
- Create: `services/scheduling-api/SchedulingApi.Tests/Fixtures/LocalDbTestFixture.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/DataLayerFoundationTests.cs`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `SchedulingApi.Entities.SessionWindowName` enum (Morning/Noon/Afternoon/Evening — member order matters, matches `DirectoryApi`'s enum of the same name for later cross-deserialization)
  - `SchedulingApi.Entities.AppointmentStatus` enum (Planned/Completed/Cancelled)
  - `SchedulingApi.Entities.Appointment` (`Id`, `TenantId`, `BranchId`, `TherapistId`, `TherapyTypeId`, `ChildId`, `WindowName`, `AppointmentDate: DateOnly`, `StartTime`/`EndTime: TimeOnly`, `PricePerSession: decimal`, `Status`, `IdempotencyKey`, `BookedBy`, `CreatedAt`)
  - `SchedulingApi.Data.SchedulingDbContext` with `DbSet<Appointment> Appointments`, tenant-filtered
  - `SchedulingApi.Tests.Fixtures.LocalDbTestFixture : WebApplicationFactory<Program>, IAsyncLifetime`

- [ ] **Step 1: Add EF Core packages**

```bash
cd services/scheduling-api/SchedulingApi
dotnet add package Microsoft.EntityFrameworkCore.SqlServer --version 9.0.19
dotnet add package Microsoft.EntityFrameworkCore.Design --version 9.0.19
cd ../../..
```

- [ ] **Step 2: Create the entity**

`services/scheduling-api/SchedulingApi/Entities/Appointment.cs`:

```csharp
namespace SchedulingApi.Entities;

public enum SessionWindowName
{
    Morning,
    Noon,
    Afternoon,
    Evening
}

public enum AppointmentStatus
{
    Planned,
    Completed,
    Cancelled
}

public class Appointment
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid TherapistId { get; set; }
    public Guid TherapyTypeId { get; set; }
    public Guid ChildId { get; set; }
    public SessionWindowName WindowName { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal PricePerSession { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Planned;
    public required string IdempotencyKey { get; set; }
    public required string BookedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 3: Create the tenancy types**

`services/scheduling-api/SchedulingApi/Tenancy/ITenantContext.cs`:

```csharp
namespace SchedulingApi.Tenancy;

public interface ITenantContext
{
    Guid TenantId { get; }
}
```

`services/scheduling-api/SchedulingApi/Tenancy/TenantContext.cs`:

```csharp
namespace SchedulingApi.Tenancy;

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

`services/scheduling-api/SchedulingApi/Tenancy/TenantIdMiddleware.cs`:

```csharp
using Microsoft.AspNetCore.Http;

namespace SchedulingApi.Tenancy;

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

- [ ] **Step 4: Create the DbContext**

`services/scheduling-api/SchedulingApi/Data/SchedulingDbContext.cs`:

```csharp
using SchedulingApi.Entities;
using SchedulingApi.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Data;

public class SchedulingDbContext(DbContextOptions<SchedulingDbContext> options, ITenantContext tenantContext)
    : DbContext(options)
{
    public DbSet<Appointment> Appointments => Set<Appointment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Appointment>(a =>
        {
            a.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            a.HasIndex(x => x.TenantId);
            a.HasIndex(x => new { x.TenantId, x.BranchId, x.TherapistId, x.TherapyTypeId, x.AppointmentDate });
            a.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
            a.Property(x => x.PricePerSession).HasColumnType("decimal(10,2)");
            a.Property(x => x.IdempotencyKey).HasMaxLength(200);
            a.Property(x => x.BookedBy).HasMaxLength(200);
        });
    }
}
```

- [ ] **Step 5: Wire everything into `Program.cs`**

Replace the full contents of `services/scheduling-api/SchedulingApi/Program.cs`:

```csharp
using SchedulingApi.Data;
using SchedulingApi.Tenancy;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddDbContext<SchedulingDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SchedulingDb"), sqlOptions => sqlOptions.EnableRetryOnFailure()));
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        db.Database.Migrate();
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseMiddleware<TenantIdMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "SchedulingApi" }));

app.Run();

public partial class Program { }
```

- [ ] **Step 6: Add the LocalDB connection string**

Read `services/scheduling-api/SchedulingApi/appsettings.Development.json` first, then replace its full contents with:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "SchedulingDb": "Server=(localdb)\\MSSQLLocalDB;Database=SchedulingApi_Dev;Trusted_Connection=True;TrustServerCertificate=True;"
  }
}
```

- [ ] **Step 7: Create the LocalDB test fixture**

`services/scheduling-api/SchedulingApi.Tests/Fixtures/LocalDbTestFixture.cs`:

```csharp
using SchedulingApi.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace SchedulingApi.Tests.Fixtures;

public class LocalDbTestFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _databaseName = $"SchedulingApiTest_{Guid.NewGuid():N}";

    public string ConnectionString =>
        $"Server=(localdb)\\MSSQLLocalDB;Database={_databaseName};Trusted_Connection=True;TrustServerCertificate=True;";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:SchedulingDb"] = ConnectionString
            });
        });
    }

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
        await db.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
        await db.Database.EnsureDeletedAsync();
        await base.DisposeAsync();
    }
}
```

- [ ] **Step 8: Write a proof-of-life test**

`services/scheduling-api/SchedulingApi.Tests/DataLayerFoundationTests.cs`:

```csharp
using SchedulingApi.Data;
using SchedulingApi.Entities;
using SchedulingApi.Tests.Fixtures;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace SchedulingApi.Tests;

public class DataLayerFoundationTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;

    public DataLayerFoundationTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CanInsertAndRetrieveAnAppointment_ThroughMigratedLocalDb()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            BranchId = Guid.NewGuid(),
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = Guid.NewGuid(),
            ChildId = Guid.NewGuid(),
            WindowName = SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1),
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(12, 0),
            PricePerSession = 500,
            IdempotencyKey = Guid.NewGuid().ToString(),
            BookedBy = "system",
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();

        using var readScope = _fixture.Services.CreateScope();
        var readDb = readScope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
        var found = await readDb.Appointments.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.Id == appointment.Id);

        Assert.NotNull(found);
        Assert.Equal(SessionWindowName.Morning, found!.WindowName);
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

`IgnoreQueryFilters()` is required — same reason as every prior service's equivalent test: no HTTP request context, `ITenantContext` never `Set()`.

- [ ] **Step 9: Generate the initial migration**

```bash
cd services/scheduling-api/SchedulingApi
dotnet ef migrations add InitialCreate --output-dir Migrations
cd ../../..
```

- [ ] **Step 10: Run the tests and verify they pass**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures. If a pre-existing `HealthEndpointTests.cs` exists from Platform Foundation, its 1 test plus these 2 new ones should total 3 — check the actual file list before assuming the count, and trust the test runner's own total.

- [ ] **Step 11: Commit**

```bash
git add services/scheduling-api/SchedulingApi services/scheduling-api/SchedulingApi.Tests
git commit -m "feat(scheduling-api): add Appointment data layer with tenant isolation"
```

---

### Task 2: Cross-service client abstractions

**Files:**
- Create: `services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`
- Create: `services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`
- Create: `services/scheduling-api/SchedulingApi/Clients/IClientRecordsApiClient.cs`
- Create: `services/scheduling-api/SchedulingApi/Clients/ClientRecordsApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi/Program.cs`
- Modify: `services/scheduling-api/SchedulingApi/appsettings.Development.json`
- Modify: `services/scheduling-api/SchedulingApi.Tests/Fixtures/LocalDbTestFixture.cs`
- Create: `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`
- Create: `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeClientRecordsApiClient.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/ClientDependencyInjectionTests.cs`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `SchedulingApi.Clients.IDirectoryApiClient` (`GetBranchAsync`, `GetTherapistAsync`, `GetTherapyTypeAsync`) — used by Task 3 and Task 4
  - `SchedulingApi.Clients.IClientRecordsApiClient` (`GetChildAsync`) — used by Task 4
  - `SchedulingApi.Clients.BranchInfo`, `TherapistInfo`, `TherapistAssignmentInfo`, `SessionWindowInfo`, `TherapyTypeInfo`, `RemoteStatus`, `ChildInfo`, `RemoteClientStatus` — used by Task 3/4/5
  - `SchedulingApi.Tests.Fakes.FakeDirectoryApiClient`/`FakeClientRecordsApiClient`, exposed via `LocalDbTestFixture.DirectoryApiClient`/`ClientRecordsApiClient` for later tasks' tests to configure

- [ ] **Step 1: Create the `IDirectoryApiClient` interface and DTOs**

`services/scheduling-api/SchedulingApi/Clients/IDirectoryApiClient.cs`:

```csharp
namespace SchedulingApi.Clients;

public enum RemoteStatus
{
    Active,
    Inactive,
    Deleted
}

public enum SessionWindowName
{
    Morning,
    Noon,
    Afternoon,
    Evening
}

public class BranchInfo
{
    public Guid Id { get; set; }
    public bool IsActive { get; set; }
}

public class TherapyTypeInfo
{
    public Guid Id { get; set; }
    public RemoteStatus Status { get; set; }
}

public class SessionWindowInfo
{
    public SessionWindowName WindowName { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal PricePerSession { get; set; }
}

public class TherapistAssignmentInfo
{
    public Guid BranchId { get; set; }
    public Guid TherapyTypeId { get; set; }
    public List<SessionWindowInfo> SessionWindows { get; set; } = [];
}

public class TherapistInfo
{
    public Guid Id { get; set; }
    public RemoteStatus Status { get; set; }
    public List<TherapistAssignmentInfo> Assignments { get; set; } = [];
}

public interface IDirectoryApiClient
{
    Task<BranchInfo?> GetBranchAsync(Guid branchId, Guid tenantId, CancellationToken cancellationToken = default);
    Task<TherapistInfo?> GetTherapistAsync(Guid therapistId, Guid tenantId, CancellationToken cancellationToken = default);
    Task<TherapyTypeInfo?> GetTherapyTypeAsync(Guid therapyTypeId, Guid tenantId, CancellationToken cancellationToken = default);
}
```

`SessionWindowName` here is `SchedulingApi.Clients.SessionWindowName` — a separate type from `SchedulingApi.Entities.SessionWindowName` (Task 1), with **identical member order** (Morning, Noon, Afternoon, Evening) so integer-based JSON deserialization from `DirectoryApi`'s response lines up. Task 3+ will need to convert between the two explicitly — this is intentional (the `Clients` namespace models what the remote service returns; `Entities` models what this service persists), not duplication to clean up.

- [ ] **Step 2: Implement `DirectoryApiClient`**

`services/scheduling-api/SchedulingApi/Clients/DirectoryApiClient.cs`:

```csharp
using System.Net.Http.Json;
using System.Text.Json;

namespace SchedulingApi.Clients;

public class DirectoryApiClient(HttpClient httpClient) : IDirectoryApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<BranchInfo?> GetBranchAsync(Guid branchId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/branches/{branchId}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<BranchInfo>(JsonOptions, cancellationToken)
            : null;
    }

    public async Task<TherapistInfo?> GetTherapistAsync(Guid therapistId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/therapists/{therapistId}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<TherapistInfo>(JsonOptions, cancellationToken)
            : null;
    }

    public async Task<TherapyTypeInfo?> GetTherapyTypeAsync(Guid therapyTypeId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/therapy-types/{therapyTypeId}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<TherapyTypeInfo>(JsonOptions, cancellationToken)
            : null;
    }
}
```

- [ ] **Step 3: Create `IClientRecordsApiClient` and implementation**

`services/scheduling-api/SchedulingApi/Clients/IClientRecordsApiClient.cs`:

```csharp
namespace SchedulingApi.Clients;

public enum RemoteClientStatus
{
    Active,
    Inactive
}

public class ChildInfo
{
    public Guid Id { get; set; }
    public RemoteClientStatus Status { get; set; }
}

public interface IClientRecordsApiClient
{
    Task<ChildInfo?> GetChildAsync(Guid childId, Guid tenantId, CancellationToken cancellationToken = default);
}
```

`services/scheduling-api/SchedulingApi/Clients/ClientRecordsApiClient.cs`:

```csharp
using System.Net.Http.Json;
using System.Text.Json;

namespace SchedulingApi.Clients;

public class ClientRecordsApiClient(HttpClient httpClient) : IClientRecordsApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<ChildInfo?> GetChildAsync(Guid childId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/children/{childId}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<ChildInfo>(JsonOptions, cancellationToken)
            : null;
    }
}
```

- [ ] **Step 4: Register the HTTP clients in `Program.cs`**

Add `using SchedulingApi.Clients;` to the top of `services/scheduling-api/SchedulingApi/Program.cs`, and add these two lines right after the existing `builder.Services.AddDbContext<SchedulingDbContext>(...)` block:

```csharp
builder.Services.AddHttpClient<IDirectoryApiClient, DirectoryApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:DirectoryApiBaseUrl"]!);
});
builder.Services.AddHttpClient<IClientRecordsApiClient, ClientRecordsApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:ClientRecordsApiBaseUrl"]!);
});
```

- [ ] **Step 5: Add the base URLs to `appsettings.Development.json`**

Read the current file first, then add a `Services` section alongside the existing `ConnectionStrings`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "SchedulingDb": "Server=(localdb)\\MSSQLLocalDB;Database=SchedulingApi_Dev;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "Services": {
    "DirectoryApiBaseUrl": "http://localhost:5256",
    "ClientRecordsApiBaseUrl": "http://localhost:5084"
  }
}
```

- [ ] **Step 6: Create the fake clients for tests**

`services/scheduling-api/SchedulingApi.Tests/Fakes/FakeDirectoryApiClient.cs`:

```csharp
using SchedulingApi.Clients;

namespace SchedulingApi.Tests.Fakes;

public class FakeDirectoryApiClient : IDirectoryApiClient
{
    public BranchInfo? BranchToReturn { get; set; }
    public TherapistInfo? TherapistToReturn { get; set; }
    public TherapyTypeInfo? TherapyTypeToReturn { get; set; }

    public Task<BranchInfo?> GetBranchAsync(Guid branchId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(BranchToReturn);

    public Task<TherapistInfo?> GetTherapistAsync(Guid therapistId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(TherapistToReturn);

    public Task<TherapyTypeInfo?> GetTherapyTypeAsync(Guid therapyTypeId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(TherapyTypeToReturn);
}
```

`services/scheduling-api/SchedulingApi.Tests/Fakes/FakeClientRecordsApiClient.cs`:

```csharp
using SchedulingApi.Clients;

namespace SchedulingApi.Tests.Fakes;

public class FakeClientRecordsApiClient : IClientRecordsApiClient
{
    public ChildInfo? ChildToReturn { get; set; }

    public Task<ChildInfo?> GetChildAsync(Guid childId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(ChildToReturn);
}
```

- [ ] **Step 7: Wire the fakes into the test fixture**

Modify `services/scheduling-api/SchedulingApi.Tests/Fixtures/LocalDbTestFixture.cs`. Add these usings: `using Microsoft.Extensions.DependencyInjection.Extensions;`, `using SchedulingApi.Clients;`, `using SchedulingApi.Tests.Fakes;`.

Add these two properties to the class, right after the existing `ConnectionString` property:

```csharp
    public FakeDirectoryApiClient DirectoryApiClient { get; } = new();
    public FakeClientRecordsApiClient ClientRecordsApiClient { get; } = new();
```

Inside `ConfigureWebHost`, after the existing `builder.ConfigureAppConfiguration(...)` call, add:

```csharp
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IDirectoryApiClient>();
            services.AddSingleton<IDirectoryApiClient>(DirectoryApiClient);
            services.RemoveAll<IClientRecordsApiClient>();
            services.AddSingleton<IClientRecordsApiClient>(ClientRecordsApiClient);
        });
```

This is why the fakes are declared as fields on the fixture rather than created fresh per test: every test in a test class sharing this fixture can set `_fixture.DirectoryApiClient.TherapistToReturn = ...` before making a request, and the DI-resolved singleton is that exact same instance.

- [ ] **Step 8: Write a test proving the fake wiring actually works**

`services/scheduling-api/SchedulingApi.Tests/ClientDependencyInjectionTests.cs`:

```csharp
using SchedulingApi.Clients;
using SchedulingApi.Tests.Fixtures;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace SchedulingApi.Tests;

public class ClientDependencyInjectionTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;

    public ClientDependencyInjectionTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public void IDirectoryApiClient_ResolvesToTheFixturesFakeInstance()
    {
        var resolved = _fixture.Services.GetRequiredService<IDirectoryApiClient>();

        Assert.Same(_fixture.DirectoryApiClient, resolved);
    }

    [Fact]
    public void IClientRecordsApiClient_ResolvesToTheFixturesFakeInstance()
    {
        var resolved = _fixture.Services.GetRequiredService<IClientRecordsApiClient>();

        Assert.Same(_fixture.ClientRecordsApiClient, resolved);
    }
}
```

- [ ] **Step 9: Run the tests and verify they pass**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total (Task 1's tests + 2 new ones here).

- [ ] **Step 10: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Clients services/scheduling-api/SchedulingApi/Program.cs services/scheduling-api/SchedulingApi/appsettings.Development.json services/scheduling-api/SchedulingApi.Tests
git commit -m "feat(scheduling-api): add DirectoryApi/ClientRecordsApi client abstractions with test fakes"
```

---

### Task 3: Availability computation + GET /availability

**Files:**
- Create: `services/scheduling-api/SchedulingApi/Services/AvailabilityCalculator.cs`
- Create: `services/scheduling-api/SchedulingApi/Dtos/AppointmentDtos.cs`
- Create: `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`
- Modify: `services/scheduling-api/SchedulingApi/Program.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/Unit/AvailabilityCalculatorTests.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/AvailabilityEndpointTests.cs`

**Interfaces:**
- Consumes: `IDirectoryApiClient`, `TherapistAssignmentInfo`, `SchedulingApi.Clients.SessionWindowName` (Task 2); `Appointment`, `SchedulingApi.Entities.SessionWindowName`, `AppointmentStatus` (Task 1); `FakeDirectoryApiClient` via `LocalDbTestFixture` (Task 2)
- Produces:
  - `SchedulingApi.Services.AvailabilityCalculator.ComputeAvailableWindows(TherapistAssignmentInfo, List<Appointment>): List<SchedulingApi.Clients.SessionWindowName>` — pure function, no DB/HTTP
  - `SchedulingApi.Dtos.AvailabilityResponse` (`AvailableWindows: List<SchedulingApi.Clients.SessionWindowName>`)
  - `GET /availability?branchId=&therapistId=&therapyTypeId=&date=`

- [ ] **Step 1: Write the failing unit tests for availability computation**

`services/scheduling-api/SchedulingApi.Tests/Unit/AvailabilityCalculatorTests.cs`:

```csharp
using SchedulingApi.Clients;
using SchedulingApi.Entities;
using SchedulingApi.Services;
using Xunit;

namespace SchedulingApi.Tests.Unit;

public class AvailabilityCalculatorTests
{
    private static TherapistAssignmentInfo AssignmentWithAllFourWindows()
    {
        var branchId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        return new TherapistAssignmentInfo
        {
            BranchId = branchId,
            TherapyTypeId = therapyTypeId,
            SessionWindows =
            [
                new() { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 },
                new() { WindowName = SessionWindowName.Afternoon, StartTime = new TimeOnly(14, 0), EndTime = new TimeOnly(16, 0), PricePerSession = 500 }
            ]
        };
    }

    [Fact]
    public void ComputeAvailableWindows_ReturnsAllWindows_WhenNoAppointmentsExist()
    {
        var result = AvailabilityCalculator.ComputeAvailableWindows(AssignmentWithAllFourWindows(), []);

        Assert.Equal(2, result.Count);
        Assert.Contains(SessionWindowName.Morning, result);
        Assert.Contains(SessionWindowName.Afternoon, result);
    }

    [Fact]
    public void ComputeAvailableWindows_ExcludesABookedWindow()
    {
        var assignment = AssignmentWithAllFourWindows();
        var bookedAppointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            BranchId = assignment.BranchId,
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = assignment.TherapyTypeId,
            ChildId = Guid.NewGuid(),
            WindowName = Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1),
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(12, 0),
            PricePerSession = 500,
            Status = AppointmentStatus.Planned,
            IdempotencyKey = Guid.NewGuid().ToString(),
            BookedBy = "system",
            CreatedAt = DateTimeOffset.UtcNow
        };

        var result = AvailabilityCalculator.ComputeAvailableWindows(assignment, [bookedAppointment]);

        Assert.DoesNotContain(SessionWindowName.Morning, result);
        Assert.Contains(SessionWindowName.Afternoon, result);
    }

    [Fact]
    public void ComputeAvailableWindows_ACancelledAppointmentsWindowStaysAvailable()
    {
        var assignment = AssignmentWithAllFourWindows();
        var cancelledAppointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            BranchId = assignment.BranchId,
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = assignment.TherapyTypeId,
            ChildId = Guid.NewGuid(),
            WindowName = Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1),
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(12, 0),
            PricePerSession = 500,
            Status = AppointmentStatus.Cancelled,
            IdempotencyKey = Guid.NewGuid().ToString(),
            BookedBy = "system",
            CreatedAt = DateTimeOffset.UtcNow
        };

        var result = AvailabilityCalculator.ComputeAvailableWindows(assignment, [cancelledAppointment]);

        Assert.Contains(SessionWindowName.Morning, result);
    }
}
```

Note the two-namespace collision: `SchedulingApi.Clients.SessionWindowName` (used for `assignment`/the calculator's return type) vs `SchedulingApi.Entities.SessionWindowName` (used for `Appointment.WindowName`) — the test above uses `SessionWindowName.Morning` (resolves to `Clients`, via the `using SchedulingApi.Clients;` at the top) for the assignment/assertions, and `Entities.SessionWindowName.Morning` (fully qualified, since `using SchedulingApi.Entities;` is also present and would otherwise be ambiguous) for the `Appointment` entity's field. This is intentional per Task 2's design note — write it exactly this way, don't try to unify the two enums.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj --filter AvailabilityCalculatorTests`
Expected: FAIL to build — `AvailabilityCalculator` doesn't exist yet

- [ ] **Step 3: Implement the calculator**

`services/scheduling-api/SchedulingApi/Services/AvailabilityCalculator.cs`:

```csharp
using SchedulingApi.Clients;
using SchedulingApi.Entities;

namespace SchedulingApi.Services;

public static class AvailabilityCalculator
{
    public static List<SessionWindowName> ComputeAvailableWindows(
        TherapistAssignmentInfo assignment,
        List<Appointment> existingAppointments)
    {
        var bookedWindows = existingAppointments
            .Where(a => a.Status != AppointmentStatus.Cancelled)
            .Select(a => (SessionWindowName)(int)a.WindowName)
            .ToHashSet();

        return assignment.SessionWindows
            .Select(w => w.WindowName)
            .Where(w => !bookedWindows.Contains(w))
            .ToList();
    }
}
```

The `(SessionWindowName)(int)a.WindowName` cast converts `Entities.SessionWindowName` to `Clients.SessionWindowName` via their shared integer value — safe specifically because Task 1 and Task 2 defined both enums with identical member order (Morning=0, Noon=1, Afternoon=2, Evening=3). Do not change either enum's member order without updating this cast.

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj --filter AvailabilityCalculatorTests`
Expected: `Passed! - Failed: 0, Passed: 3`

- [ ] **Step 5: Create the DTOs and write the failing endpoint test**

`services/scheduling-api/SchedulingApi/Dtos/AppointmentDtos.cs`:

```csharp
using SchedulingApi.Clients;

namespace SchedulingApi.Dtos;

public class AvailabilityResponse
{
    public required List<SessionWindowName> AvailableWindows { get; set; }
}
```

`services/scheduling-api/SchedulingApi.Tests/AvailabilityEndpointTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using SchedulingApi.Clients;
using SchedulingApi.Dtos;
using SchedulingApi.Tests.Fixtures;
using Xunit;

namespace SchedulingApi.Tests;

public class AvailabilityEndpointTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;
    private readonly HttpClient _client;

    public AvailabilityEndpointTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.CreateClient();
    }

    private HttpRequestMessage WithTenant(HttpMethod method, string url, Guid tenantId)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        return request;
    }

    [Fact]
    public async Task GetAvailability_ReturnsOpenWindows_WhenTherapistHasAssignmentAndNoBookings()
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

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/availability?branchId={branchId}&therapistId={therapistId}&therapyTypeId={therapyTypeId}&date=2026-09-01", tenantId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<AvailabilityResponse>();
        Assert.Contains(SessionWindowName.Morning, body!.AvailableWindows);
    }

    [Fact]
    public async Task GetAvailability_Returns404_WhenTherapistNotFound()
    {
        var tenantId = Guid.NewGuid();
        _fixture.DirectoryApiClient.TherapistToReturn = null;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/availability?branchId={Guid.NewGuid()}&therapistId={Guid.NewGuid()}&therapyTypeId={Guid.NewGuid()}&date=2026-09-01", tenantId));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj --filter AvailabilityEndpointTests`
Expected: FAIL — no `/availability` route mapped yet

- [ ] **Step 7: Implement the endpoint**

`services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`:

```csharp
using SchedulingApi.Clients;
using SchedulingApi.Data;
using SchedulingApi.Dtos;
using SchedulingApi.Services;
using SchedulingApi.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Endpoints;

public static class AppointmentEndpoints
{
    public static void MapAppointmentEndpoints(this WebApplication app)
    {
        app.MapGet("/availability", async (Guid branchId, Guid therapistId, Guid therapyTypeId, DateOnly date, SchedulingDbContext db, IDirectoryApiClient directoryClient, ITenantContext tenantContext) =>
        {
            var therapist = await directoryClient.GetTherapistAsync(therapistId, tenantContext.TenantId);
            if (therapist is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist not found");
            }

            var assignment = therapist.Assignments.FirstOrDefault(a => a.BranchId == branchId && a.TherapyTypeId == therapyTypeId);
            if (assignment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist is not assigned to this branch/therapy type");
            }

            var existingAppointments = await db.Appointments
                .Where(a => a.BranchId == branchId && a.TherapistId == therapistId && a.TherapyTypeId == therapyTypeId && a.AppointmentDate == date)
                .ToListAsync();

            var availableWindows = AvailabilityCalculator.ComputeAvailableWindows(assignment, existingAppointments);

            return Results.Ok(new AvailabilityResponse { AvailableWindows = availableWindows });
        });

        var group = app.MapGroup("/appointments");
        // GET/POST/PUT/DELETE on this group are added in later tasks.
    }
}
```

- [ ] **Step 8: Map the endpoints in `Program.cs`**

Add `using SchedulingApi.Endpoints;` to the top of `services/scheduling-api/SchedulingApi/Program.cs`, and add this line right after the existing `app.MapGet("/health", ...)` line:

```csharp
app.MapAppointmentEndpoints();
```

- [ ] **Step 9: Run the tests and verify they pass**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 10: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Services services/scheduling-api/SchedulingApi/Dtos services/scheduling-api/SchedulingApi/Endpoints services/scheduling-api/SchedulingApi/Program.cs services/scheduling-api/SchedulingApi.Tests
git commit -m "feat(scheduling-api): add availability computation and GET /availability"
```

---

### Task 4: POST /appointments (booking, with idempotency and full validation chain)

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/Dtos/AppointmentDtos.cs`
- Create: `services/scheduling-api/SchedulingApi/Validation/DataAnnotationsValidator.cs`
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`
- Test: `services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs`

**Interfaces:**
- Consumes: `IDirectoryApiClient`, `IClientRecordsApiClient` (Task 2), `AvailabilityCalculator`'s enum-casting convention (Task 3), `Appointment` (Task 1)
- Produces: `CreateAppointmentRequest`, `AppointmentResponse`; `POST /appointments`

- [ ] **Step 1: Add the remaining DTOs**

Add to `services/scheduling-api/SchedulingApi/Dtos/AppointmentDtos.cs` (append below `AvailabilityResponse`, add `using System.ComponentModel.DataAnnotations;` and `using SchedulingApi.Entities;` to the top of the file):

```csharp
public class CreateAppointmentRequest
{
    [Required]
    public Guid BranchId { get; set; }

    [Required]
    public Guid TherapistId { get; set; }

    [Required]
    public Guid TherapyTypeId { get; set; }

    [Required]
    public Guid ChildId { get; set; }

    [Required]
    public SessionWindowName? WindowName { get; set; }

    [Required]
    public DateOnly? AppointmentDate { get; set; }
}

public class AppointmentResponse
{
    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public Guid TherapistId { get; set; }
    public Guid TherapyTypeId { get; set; }
    public Guid ChildId { get; set; }
    public SessionWindowName WindowName { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal PricePerSession { get; set; }
    public AppointmentStatus Status { get; set; }
}
```

`WindowName`/`AppointmentDate` are nullable (`SessionWindowName?`, `DateOnly?`) even though the entity's fields aren't — a non-nullable value type makes `[Required]` a no-op (it only rejects `null`, never a struct's default value), a bug already found and fixed once in `ClientRecordsApi`'s final review. `SessionWindowName` here resolves to `SchedulingApi.Entities.SessionWindowName` (the file's `using SchedulingApi.Entities;`), since a request body's window name is what this service will persist — a different case from the `Clients`-namespace one used in `AvailabilityResponse`/`AvailabilityCalculator`.

- [ ] **Step 2: Create the validator**

`services/scheduling-api/SchedulingApi/Validation/DataAnnotationsValidator.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace SchedulingApi.Validation;

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

- [ ] **Step 3: Write the failing tests**

`services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using SchedulingApi.Clients;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Tests.Fixtures;
using Xunit;

namespace SchedulingApi.Tests;

public class AppointmentBookingTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;
    private readonly HttpClient _client;

    public AppointmentBookingTests(LocalDbTestFixture fixture)
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

    private void SetUpValidReferences(Guid branchId, Guid therapistId, Guid therapyTypeId, Guid childId)
    {
        _fixture.DirectoryApiClient.BranchToReturn = new BranchInfo { Id = branchId, IsActive = true };
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
        _fixture.ClientRecordsApiClient.ChildToReturn = new ChildInfo { Id = childId, Status = RemoteClientStatus.Active };
    }

    [Fact]
    public async Task PostAppointment_WithValidReferences_CreatesAppointment()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<AppointmentResponse>();
        Assert.Equal(AppointmentStatus.Planned, body!.Status);
        Assert.Equal(500, body.PricePerSession);
    }

    [Fact]
    public async Task PostAppointment_WithoutIdempotencyKey_Returns400()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, idempotencyKey: null, body: new CreateAppointmentRequest
        {
            BranchId = Guid.NewGuid(),
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = Guid.NewGuid(),
            ChildId = Guid.NewGuid(),
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact(Skip = "Depends on GET /appointments — enabled in Task 5")]
    public async Task PostAppointment_WithSameIdempotencyKeyTwice_ReturnsTheSameAppointmentBothTimes_OnlyOneRowPersisted()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        var idempotencyKey = Guid.NewGuid().ToString();
        var request = new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        };

        var first = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, idempotencyKey, request));
        var firstBody = await first.Content.ReadFromJsonAsync<AppointmentResponse>();

        var second = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, idempotencyKey, request));
        var secondBody = await second.Content.ReadFromJsonAsync<AppointmentResponse>();

        Assert.Equal(firstBody!.Id, secondBody!.Id);

        var listResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, "/appointments", tenantId));
        var listBody = await listResponse.Content.ReadFromJsonAsync<Common.PagedResult<AppointmentResponse>>();
        Assert.Single(listBody!.Items.Where(a => a.Id == firstBody.Id));
    }

    [Fact]
    public async Task PostAppointment_WithCrossTenantBranch_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        _fixture.DirectoryApiClient.BranchToReturn = null;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = Guid.NewGuid(),
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = Guid.NewGuid(),
            ChildId = Guid.NewGuid(),
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostAppointment_WhenWindowAlreadyBooked_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        var request = new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        };
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), request));

        var secondBooking = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), request));

        Assert.Equal(HttpStatusCode.Conflict, secondBooking.StatusCode);
    }
}
```

Note: `PostAppointment_WithSameIdempotencyKeyTwice...` references `GET /appointments` (list) and `Common.PagedResult<AppointmentResponse>`, which don't exist until Task 5. It's written now (belongs conceptually with idempotency) but marked `[Fact(Skip = "Depends on GET /appointments — enabled in Task 5")]` for this task — Task 5's brief removes the `Skip`.

- [ ] **Step 4: Run tests to verify the enabled ones fail**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj --filter AppointmentBookingTests`
Expected: FAIL — no `POST /appointments` route mapped yet (the skipped idempotency-list test doesn't count as a failure)

- [ ] **Step 5: Implement `POST /appointments`**

Add `using SchedulingApi.Entities;`, `using SchedulingApi.Tenancy;`, `using SchedulingApi.Validation;`, `using Microsoft.AspNetCore.Http;` to the top of `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`.

Replace the `// GET/POST/PUT/DELETE on this group are added in later tasks.` comment with:

```csharp
        group.MapPost("", async (CreateAppointmentRequest request, HttpRequest httpRequest, SchedulingDbContext db, IDirectoryApiClient directoryClient, IClientRecordsApiClient clientRecordsClient, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (!httpRequest.Headers.TryGetValue("Idempotency-Key", out var idempotencyKeyValues) || string.IsNullOrWhiteSpace(idempotencyKeyValues.ToString()))
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Missing Idempotency-Key header", detail: "POST /appointments requires an Idempotency-Key header.");
            }
            var idempotencyKey = idempotencyKeyValues.ToString();

            var existing = await db.Appointments.FirstOrDefaultAsync(a => a.IdempotencyKey == idempotencyKey);
            if (existing is not null)
            {
                return Results.Created($"/appointments/{existing.Id}", ToResponse(existing));
            }

            var branch = await directoryClient.GetBranchAsync(request.BranchId, tenantContext.TenantId);
            if (branch is null || !branch.IsActive)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["branchId"] = ["Branch not found or not active."] });
            }

            var therapist = await directoryClient.GetTherapistAsync(request.TherapistId, tenantContext.TenantId);
            if (therapist is null || therapist.Status != RemoteStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["therapistId"] = ["Therapist not found or not active."] });
            }

            var assignment = therapist.Assignments.FirstOrDefault(a => a.BranchId == request.BranchId && a.TherapyTypeId == request.TherapyTypeId);
            if (assignment is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["therapyTypeId"] = ["Therapist is not assigned to this branch/therapy type."] });
            }

            var clientWindowName = (SchedulingApi.Clients.SessionWindowName)(int)request.WindowName!.Value;
            var sessionWindow = assignment.SessionWindows.FirstOrDefault(w => w.WindowName == clientWindowName);
            if (sessionWindow is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["windowName"] = ["This therapist does not have that session window for this branch/therapy type."] });
            }

            var child = await clientRecordsClient.GetChildAsync(request.ChildId, tenantContext.TenantId);
            if (child is null || child.Status != RemoteClientStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["childId"] = ["Child not found or not active."] });
            }

            var conflict = await db.Appointments.AnyAsync(a =>
                a.BranchId == request.BranchId &&
                a.TherapistId == request.TherapistId &&
                a.TherapyTypeId == request.TherapyTypeId &&
                a.WindowName == request.WindowName!.Value &&
                a.AppointmentDate == request.AppointmentDate!.Value &&
                a.Status != AppointmentStatus.Cancelled);
            if (conflict)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This session window is already booked for the requested date.");
            }

            var appointment = new Appointment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                BranchId = request.BranchId,
                TherapistId = request.TherapistId,
                TherapyTypeId = request.TherapyTypeId,
                ChildId = request.ChildId,
                WindowName = request.WindowName!.Value,
                AppointmentDate = request.AppointmentDate!.Value,
                StartTime = sessionWindow.StartTime,
                EndTime = sessionWindow.EndTime,
                PricePerSession = sessionWindow.PricePerSession,
                Status = AppointmentStatus.Planned,
                IdempotencyKey = idempotencyKey!,
                BookedBy = "system",
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.Appointments.Add(appointment);
            await db.SaveChangesAsync();

            return Results.Created($"/appointments/{appointment.Id}", ToResponse(appointment));
        });
```

Add this private method at the bottom of the `AppointmentEndpoints` class (after the closing brace of `MapAppointmentEndpoints`):

```csharp
    private static AppointmentResponse ToResponse(Appointment appointment) => new()
    {
        Id = appointment.Id,
        BranchId = appointment.BranchId,
        TherapistId = appointment.TherapistId,
        TherapyTypeId = appointment.TherapyTypeId,
        ChildId = appointment.ChildId,
        WindowName = appointment.WindowName,
        AppointmentDate = appointment.AppointmentDate,
        StartTime = appointment.StartTime,
        EndTime = appointment.EndTime,
        PricePerSession = appointment.PricePerSession,
        Status = appointment.Status
    };
```

- [ ] **Step 6: Run tests to verify the enabled ones pass**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures, 1 skipped (the idempotency-list test stays skipped until Task 5) — trust the test runner's own total.

- [ ] **Step 7: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Dtos services/scheduling-api/SchedulingApi/Validation services/scheduling-api/SchedulingApi/Endpoints services/scheduling-api/SchedulingApi.Tests
git commit -m "feat(scheduling-api): add appointment booking with idempotency and cross-service validation"
```

---

### Task 5: Read/list, reschedule, cancel

**Files:**
- Create: `services/scheduling-api/SchedulingApi/Common/PagedResult.cs`
- Modify: `services/scheduling-api/SchedulingApi/Dtos/AppointmentDtos.cs`
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`
- Modify: `services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs` (un-skip the idempotency-list test)
- Test: `services/scheduling-api/SchedulingApi.Tests/AppointmentLifecycleTests.cs`

**Interfaces:**
- Consumes: everything from Tasks 1-4
- Produces: `PagedResult<T>`, `UpdateAppointmentRequest`; `GET /appointments/{id}`, `GET /appointments`, `PUT /appointments/{id}`, `DELETE /appointments/{id}`

- [ ] **Step 1: Create the pagination envelope**

`services/scheduling-api/SchedulingApi/Common/PagedResult.cs`:

```csharp
namespace SchedulingApi.Common;

public class PagedResult<T>
{
    public required List<T> Items { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}
```

- [ ] **Step 2: Add `UpdateAppointmentRequest`**

Add to `services/scheduling-api/SchedulingApi/Dtos/AppointmentDtos.cs` (append below `AppointmentResponse`):

```csharp
public class UpdateAppointmentRequest
{
    [Required]
    public SessionWindowName? WindowName { get; set; }

    [Required]
    public DateOnly? AppointmentDate { get; set; }
}
```

- [ ] **Step 3: Un-skip the idempotency-list test**

In `services/scheduling-api/SchedulingApi.Tests/AppointmentBookingTests.cs`, find `PostAppointment_WithSameIdempotencyKeyTwice_ReturnsTheSameAppointmentBothTimes_OnlyOneRowPersisted` and remove its `[Fact(Skip = "...")]` attribute, replacing it with plain `[Fact]`.

- [ ] **Step 4: Write the failing lifecycle tests**

`services/scheduling-api/SchedulingApi.Tests/AppointmentLifecycleTests.cs`:

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

public class AppointmentLifecycleTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;
    private readonly HttpClient _client;

    public AppointmentLifecycleTests(LocalDbTestFixture fixture)
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

    private async Task<(Guid appointmentId, Guid branchId, Guid therapistId, Guid therapyTypeId, Guid childId)> BookAnAppointmentAsync(Guid tenantId)
    {
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();

        _fixture.DirectoryApiClient.BranchToReturn = new BranchInfo { Id = branchId, IsActive = true };
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
                    SessionWindows =
                    [
                        new SessionWindowInfo { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 },
                        new SessionWindowInfo { WindowName = SessionWindowName.Afternoon, StartTime = new TimeOnly(14, 0), EndTime = new TimeOnly(16, 0), PricePerSession = 600 }
                    ]
                }
            ]
        };
        _fixture.ClientRecordsApiClient.ChildToReturn = new ChildInfo { Id = childId, Status = RemoteClientStatus.Active };

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));
        var body = await created.Content.ReadFromJsonAsync<AppointmentResponse>();

        return (body!.Id, branchId, therapistId, therapyTypeId, childId);
    }

    [Fact]
    public async Task GetAppointmentById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var (appointmentId, _, _, _, _) = await BookAnAppointmentAsync(tenantA);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/appointments/{appointmentId}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListAppointments_NeverReturnsAnotherTenantsAppointments()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        await BookAnAppointmentAsync(tenantA);
        await BookAnAppointmentAsync(tenantB);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/appointments", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<AppointmentResponse>>();

        Assert.Single(body!.Items);
    }

    [Fact]
    public async Task PutAppointment_ReschedulesToADifferentWindow()
    {
        var tenantId = Guid.NewGuid();
        var (appointmentId, _, _, _, _) = await BookAnAppointmentAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/appointments/{appointmentId}", tenantId, body: new UpdateAppointmentRequest
        {
            WindowName = SchedulingApi.Entities.SessionWindowName.Afternoon,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<AppointmentResponse>();
        Assert.Equal(SchedulingApi.Entities.SessionWindowName.Afternoon, body!.WindowName);
        Assert.Equal(600, body.PricePerSession);
    }

    [Fact]
    public async Task DeleteAppointment_CancelsIt_SlotBecomesAvailableAgain()
    {
        var tenantId = Guid.NewGuid();
        var (appointmentId, branchId, therapistId, therapyTypeId, _) = await BookAnAppointmentAsync(tenantId);

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/appointments/{appointmentId}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var availabilityResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/availability?branchId={branchId}&therapistId={therapistId}&therapyTypeId={therapyTypeId}&date=2026-09-01", tenantId));
        var availabilityBody = await availabilityResponse.Content.ReadFromJsonAsync<AvailabilityResponse>();

        Assert.Contains(SessionWindowName.Morning, availabilityBody!.AvailableWindows);
    }
}
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj --filter AppointmentLifecycleTests`
Expected: FAIL — no `GET/PUT/DELETE /appointments/{id}` or `GET /appointments` routes mapped yet

- [ ] **Step 6: Implement the remaining endpoints**

Add `using SchedulingApi.Common;` to the top of `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`.

Inside the `group` block, right before the existing `group.MapPost(...)` call, add:

```csharp
        group.MapGet("", async (int? page, int? pageSize, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Appointments.OrderByDescending(a => a.AppointmentDate);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<AppointmentResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, SchedulingDbContext db) =>
        {
            var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
            return appointment is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Appointment not found")
                : Results.Ok(ToResponse(appointment));
        });
```

Right after the existing `group.MapPost(...)` call's closing `});`, add:

```csharp
        group.MapPut("/{id:guid}", async (Guid id, UpdateAppointmentRequest request, SchedulingDbContext db, IDirectoryApiClient directoryClient, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Appointment not found");
            }

            var therapist = await directoryClient.GetTherapistAsync(appointment.TherapistId, tenantContext.TenantId);
            var assignment = therapist?.Assignments.FirstOrDefault(a => a.BranchId == appointment.BranchId && a.TherapyTypeId == appointment.TherapyTypeId);
            var clientWindowName = (SchedulingApi.Clients.SessionWindowName)(int)request.WindowName!.Value;
            var sessionWindow = assignment?.SessionWindows.FirstOrDefault(w => w.WindowName == clientWindowName);
            if (sessionWindow is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["windowName"] = ["This therapist does not have that session window for this branch/therapy type."] });
            }

            var conflict = await db.Appointments.AnyAsync(a =>
                a.Id != id &&
                a.BranchId == appointment.BranchId &&
                a.TherapistId == appointment.TherapistId &&
                a.TherapyTypeId == appointment.TherapyTypeId &&
                a.WindowName == request.WindowName!.Value &&
                a.AppointmentDate == request.AppointmentDate!.Value &&
                a.Status != AppointmentStatus.Cancelled);
            if (conflict)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This session window is already booked for the requested date.");
            }

            appointment.WindowName = request.WindowName!.Value;
            appointment.AppointmentDate = request.AppointmentDate!.Value;
            appointment.StartTime = sessionWindow.StartTime;
            appointment.EndTime = sessionWindow.EndTime;
            appointment.PricePerSession = sessionWindow.PricePerSession;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(appointment));
        });

        group.MapDelete("/{id:guid}", async (Guid id, SchedulingDbContext db) =>
        {
            var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Appointment not found");
            }

            appointment.Status = AppointmentStatus.Cancelled;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
```

- [ ] **Step 7: Run the full test suite and verify everything passes**

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 0 failures, 0 skipped — trust the test runner's own total over predicted arithmetic.

- [ ] **Step 8: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Common services/scheduling-api/SchedulingApi/Dtos services/scheduling-api/SchedulingApi/Endpoints services/scheduling-api/SchedulingApi.Tests
git commit -m "feat(scheduling-api): add appointment read/list/reschedule/cancel"
```

---

## Definition of done for this plan

- [ ] `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj` passes with 0 failures, 0 skipped
- [ ] Every endpoint in design spec §6 exists and returns the documented status codes
- [ ] Tenant isolation verified by a passing integration test on `Appointment`, by-ID and by-list
- [ ] Idempotency verified: same key submitted twice creates exactly one row
- [ ] A cancelled appointment's slot is confirmed available again via a `GET /availability` call
- [ ] Every commit from this plan is present in `git log`
