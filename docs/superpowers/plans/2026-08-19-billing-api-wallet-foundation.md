# BillingApi Wallet Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `BillingApi` as a new service with `Wallet`/`WalletTransaction`, and wire `SchedulingApi`'s refund approval flow to actually credit the parent's wallet — closing Phase 2's refund-approval loop and starting Phase 3. Based on `docs/superpowers/specs/2026-08-19-billing-api-wallet-foundation-design.md`.

**Architecture:** A new ASP.NET Core 9 Minimal API service (`services/billing-api/BillingApi/`) mirroring `ClientRecordsApi`'s scaffolding exactly (own Azure SQL/LocalDB database, `X-Tenant-Id` stub tenancy, RFC 7807). `SchedulingApi`'s `RefundRequestEndpoints` approve handler gains a new cross-service call to `BillingApi`, with **non-fail-open** semantics (a first for this platform — see Global Constraints).

**Tech Stack:** .NET 9, EF Core 9.0.19, SQL Server LocalDB (dev/tests). No new external packages beyond what every other service already uses.

## Global Constraints

- **This is genuinely risky/architectural work (new service, first real money movement) — full un-batched SDD rigor applies: review every task individually, no batching**, even though no new `[Fact]` tests are written (per the standing 2026-08-19 test-deferral policy — see below).
- **Unit/integration test-writing is deferred to a later consolidated pass** (🔴 item in `DEFERRED-AND-TODO.md`). Acceptance per task is: builds clean, existing suites pass unchanged, and (Task 1 only) a manual smoke check that the new service starts and responds — not a new `[Fact]`.
- Every entity is tenant-scoped: EF Core query filter + `HasIndex(TenantId)`.
- `Wallet.ParentId` and `Child`/`Parent` in general are **not FK-validated** across services — `Parent` lives in `ClientRecordsApi`, a different database.
- `Balance` is denormalized and updated in the same `SaveChangesAsync()` call as the `WalletTransaction` insert — never recomputed from the ledger on read.
- `POST /wallets/{parentId}/credit` and `POST /wallets/{parentId}/debit` both require an `Idempotency-Key` header (missing → `400`; over 200 chars → `400`), exactly mirroring `SchedulingApi`'s `POST /appointments` pattern: check for an existing `WalletTransaction` with that key first (replay), catch the DB-level unique-violation race narrowly (`SqlException { Number: 2601 or 2627 }`, never a bare `catch (DbUpdateException)`), replay on the caught race too.
- `Balance` never goes negative — a debit that would take it below zero returns `409`, whether or not a wallet even exists yet.
- **Cross-service failure semantics for the refund-to-credit call are deliberately NOT fail-open** — this is the opposite of every existing cross-service check on this platform (`IsBranchClosedAsync`, `IsTherapistOnLeaveAsync`, both of which return `null`/fail-open on a downstream outage). If the wallet credit call to `BillingApi` fails for any reason, `POST /refund-requests/{id}/approve` must return `502 Bad Gateway` and leave `RefundRequest.Status` as `Pending` — never flip it to `Approved` without a confirmed credit. Do not "fix" this to match the fail-open pattern elsewhere; it is intentionally different because money movement, unlike an advisory availability check, must not silently proceed on failure.
- Every error response is RFC 7807.

---

### Task 1: BillingApi service — scaffold, Wallet, WalletTransaction

**Files:**
- Create: `services/billing-api/BillingApi/BillingApi.csproj`
- Create: `services/billing-api/BillingApi/Program.cs`
- Create: `services/billing-api/BillingApi/appsettings.json`
- Create: `services/billing-api/BillingApi/appsettings.Development.json`
- Create: `services/billing-api/BillingApi/Properties/launchSettings.json`
- Create: `services/billing-api/BillingApi/Tenancy/ITenantContext.cs`
- Create: `services/billing-api/BillingApi/Tenancy/TenantContext.cs`
- Create: `services/billing-api/BillingApi/Tenancy/TenantIdMiddleware.cs`
- Create: `services/billing-api/BillingApi/Common/PagedResult.cs`
- Create: `services/billing-api/BillingApi/Validation/DataAnnotationsValidator.cs`
- Create: `services/billing-api/BillingApi/Entities/Wallet.cs`
- Create: `services/billing-api/BillingApi/Data/BillingDbContext.cs`
- Create: `services/billing-api/BillingApi/Dtos/WalletDtos.cs`
- Create: `services/billing-api/BillingApi/Endpoints/WalletEndpoints.cs`
- Create: `services/billing-api/BillingApi/Migrations/*`
- Create: `services/billing-api/BillingApi.Tests/BillingApi.Tests.csproj`
- Create: `services/billing-api/BillingApi.Tests/Fixtures/LocalDbTestFixture.cs`
- Modify: `AppointmentBooking.sln`

**Interfaces:**
- Produces: `GET /wallets/{parentId}`, `GET /wallets/{parentId}/transactions`, `POST /wallets/{parentId}/credit`, `POST /wallets/{parentId}/debit`, `GET /health`. `Wallet`/`WalletTransaction` entities and `WalletTransactionType` enum in `BillingApi.Entities`, consumed by Task 2.

- [ ] **Step 1: Create the service project**

`services/billing-api/BillingApi/BillingApi.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="9.0.19">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="9.0.19" />
  </ItemGroup>

</Project>
```

- [ ] **Step 2: Tenancy (identical to every other service)**

`services/billing-api/BillingApi/Tenancy/ITenantContext.cs`:

```csharp
namespace BillingApi.Tenancy;

public interface ITenantContext
{
    Guid TenantId { get; }
}
```

`services/billing-api/BillingApi/Tenancy/TenantContext.cs`:

```csharp
namespace BillingApi.Tenancy;

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

`services/billing-api/BillingApi/Tenancy/TenantIdMiddleware.cs`:

```csharp
using Microsoft.AspNetCore.Http;

namespace BillingApi.Tenancy;

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

- [ ] **Step 3: Common/Validation helpers (byte-for-byte identical to every other service)**

`services/billing-api/BillingApi/Common/PagedResult.cs`:

```csharp
namespace BillingApi.Common;

public class PagedResult<T>
{
    public required List<T> Items { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}
```

`services/billing-api/BillingApi/Validation/DataAnnotationsValidator.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace BillingApi.Validation;

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

- [ ] **Step 4: Entities**

`services/billing-api/BillingApi/Entities/Wallet.cs`:

```csharp
namespace BillingApi.Entities;

public class Wallet
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ParentId { get; set; }
    public decimal Balance { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public enum WalletTransactionType
{
    Credit,
    Debit
}

public class WalletTransaction
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid WalletId { get; set; }
    public WalletTransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public Guid? RelatedAppointmentId { get; set; }
    public required string Reason { get; set; }
    public required string IdempotencyKey { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 5: DbContext**

`services/billing-api/BillingApi/Data/BillingDbContext.cs`:

```csharp
using BillingApi.Entities;
using BillingApi.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace BillingApi.Data;

public class BillingDbContext(DbContextOptions<BillingDbContext> options, ITenantContext tenantContext)
    : DbContext(options)
{
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Wallet>(w =>
        {
            w.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            w.HasIndex(x => x.TenantId);
            w.HasIndex(x => new { x.TenantId, x.ParentId }).IsUnique();
            w.Property(x => x.Balance).HasColumnType("decimal(10,2)");
        });

        modelBuilder.Entity<WalletTransaction>(t =>
        {
            t.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            t.HasIndex(x => x.TenantId);
            t.HasIndex(x => x.WalletId);
            t.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
            t.Property(x => x.Amount).HasColumnType("decimal(10,2)");
            t.Property(x => x.Reason).HasMaxLength(500);
            t.Property(x => x.IdempotencyKey).HasMaxLength(200);
        });
    }
}
```

- [ ] **Step 6: DTOs**

`services/billing-api/BillingApi/Dtos/WalletDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using BillingApi.Entities;

namespace BillingApi.Dtos;

public class CreditWalletRequest
{
    [Required]
    public decimal? Amount { get; set; }

    [Required, MaxLength(500)]
    public required string Reason { get; set; }

    public Guid? RelatedAppointmentId { get; set; }
}

public class DebitWalletRequest
{
    [Required]
    public decimal? Amount { get; set; }

    [Required, MaxLength(500)]
    public required string Reason { get; set; }

    public Guid? RelatedAppointmentId { get; set; }
}

public class WalletResponse
{
    public Guid Id { get; set; }
    public Guid ParentId { get; set; }
    public decimal Balance { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class WalletTransactionResponse
{
    public Guid Id { get; set; }
    public Guid WalletId { get; set; }
    public WalletTransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public Guid? RelatedAppointmentId { get; set; }
    public required string Reason { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 7: Endpoints**

`services/billing-api/BillingApi/Endpoints/WalletEndpoints.cs`:

```csharp
using BillingApi.Common;
using BillingApi.Data;
using BillingApi.Dtos;
using BillingApi.Entities;
using BillingApi.Tenancy;
using BillingApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace BillingApi.Endpoints;

public static class WalletEndpoints
{
    public static void MapWalletEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/wallets");

        group.MapGet("/{parentId:guid}", async (Guid parentId, BillingDbContext db) =>
        {
            var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.ParentId == parentId);
            return wallet is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Wallet not found", detail: "This parent has no wallet yet.")
                : Results.Ok(ToWalletResponse(wallet));
        });

        group.MapGet("/{parentId:guid}/transactions", async (Guid parentId, int? page, int? pageSize, WalletTransactionType? type, BillingDbContext db) =>
        {
            var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.ParentId == parentId);
            if (wallet is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Wallet not found", detail: "This parent has no wallet yet.");
            }

            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.WalletTransactions.Where(t => t.WalletId == wallet.Id).AsQueryable();
            if (type is not null)
            {
                query = query.Where(t => t.Type == type);
            }
            query = query.OrderByDescending(t => t.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<WalletTransactionResponse>
            {
                Items = items.Select(ToTransactionResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapPost("/{parentId:guid}/credit", async (Guid parentId, CreditWalletRequest request, HttpRequest httpRequest, BillingDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var (idempotencyKey, keyError) = ReadIdempotencyKey(httpRequest);
            if (keyError is not null)
            {
                return keyError;
            }

            var existing = await db.WalletTransactions.FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
            if (existing is not null)
            {
                return Results.Ok(ToTransactionResponse(existing));
            }

            var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.ParentId == parentId);
            if (wallet is null)
            {
                wallet = new Wallet
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantContext.TenantId,
                    ParentId = parentId,
                    Balance = 0m,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                db.Wallets.Add(wallet);
            }

            wallet.Balance += request.Amount!.Value;

            var transaction = new WalletTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                WalletId = wallet.Id,
                Type = WalletTransactionType.Credit,
                Amount = request.Amount!.Value,
                RelatedAppointmentId = request.RelatedAppointmentId,
                Reason = request.Reason,
                IdempotencyKey = idempotencyKey!,
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.WalletTransactions.Add(transaction);

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                db.ChangeTracker.Clear();
                var raced = await db.WalletTransactions.AsNoTracking().FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
                if (raced is not null)
                {
                    return Results.Ok(ToTransactionResponse(raced));
                }
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Concurrent credit conflict", detail: "Please retry the request.");
            }

            return Results.Ok(ToTransactionResponse(transaction));
        });

        group.MapPost("/{parentId:guid}/debit", async (Guid parentId, DebitWalletRequest request, HttpRequest httpRequest, BillingDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var (idempotencyKey, keyError) = ReadIdempotencyKey(httpRequest);
            if (keyError is not null)
            {
                return keyError;
            }

            var existing = await db.WalletTransactions.FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
            if (existing is not null)
            {
                return Results.Ok(ToTransactionResponse(existing));
            }

            var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.ParentId == parentId);
            if (wallet is null || wallet.Balance < request.Amount!.Value)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Insufficient balance", detail: "This wallet does not have enough balance to cover this debit.");
            }

            wallet.Balance -= request.Amount!.Value;

            var transaction = new WalletTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                WalletId = wallet.Id,
                Type = WalletTransactionType.Debit,
                Amount = request.Amount!.Value,
                RelatedAppointmentId = request.RelatedAppointmentId,
                Reason = request.Reason,
                IdempotencyKey = idempotencyKey!,
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.WalletTransactions.Add(transaction);

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                db.ChangeTracker.Clear();
                var raced = await db.WalletTransactions.AsNoTracking().FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
                if (raced is not null)
                {
                    return Results.Ok(ToTransactionResponse(raced));
                }
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Concurrent debit conflict", detail: "Please retry the request.");
            }

            return Results.Ok(ToTransactionResponse(transaction));
        });
    }

    private static (string? Key, IResult? Error) ReadIdempotencyKey(HttpRequest httpRequest)
    {
        if (!httpRequest.Headers.TryGetValue("Idempotency-Key", out var values) || string.IsNullOrWhiteSpace(values.ToString()))
        {
            return (null, Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Missing Idempotency-Key header", detail: "This endpoint requires an Idempotency-Key header."));
        }
        var key = values.ToString();
        if (key.Length > 200)
        {
            return (null, Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Idempotency-Key header is too long", detail: "Idempotency-Key must be 200 characters or fewer."));
        }
        return (key, null);
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };

    private static WalletResponse ToWalletResponse(Wallet wallet) => new()
    {
        Id = wallet.Id,
        ParentId = wallet.ParentId,
        Balance = wallet.Balance,
        CreatedAt = wallet.CreatedAt
    };

    private static WalletTransactionResponse ToTransactionResponse(WalletTransaction transaction) => new()
    {
        Id = transaction.Id,
        WalletId = transaction.WalletId,
        Type = transaction.Type,
        Amount = transaction.Amount,
        RelatedAppointmentId = transaction.RelatedAppointmentId,
        Reason = transaction.Reason,
        CreatedAt = transaction.CreatedAt
    };
}
```

- [ ] **Step 8: Program.cs**

`services/billing-api/BillingApi/Program.cs`:

```csharp
using BillingApi.Data;
using BillingApi.Endpoints;
using BillingApi.Tenancy;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddDbContext<BillingDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("BillingDb"), sqlOptions => sqlOptions.EnableRetryOnFailure()));
builder.Services.AddScoped<TenantContext>();
builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BillingDbContext>();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        db.Database.Migrate();
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseMiddleware<TenantIdMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "BillingApi" }));
app.MapWalletEndpoints();

app.Run();

public partial class Program { }
```

- [ ] **Step 9: appsettings and launch settings**

`services/billing-api/BillingApi/appsettings.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

`services/billing-api/BillingApi/appsettings.Development.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "BillingDb": "Server=(localdb)\\MSSQLLocalDB;Database=BillingApi_Dev;Trusted_Connection=True;TrustServerCertificate=True;"
  }
}
```

`services/billing-api/BillingApi/Properties/launchSettings.json` — port `5320`/`7331` (unused by any existing service: `DirectoryApi` is `5256`, `SchedulingApi` is `5098`, `ClientRecordsApi` is `5084`):

```json
{
  "$schema": "https://json.schemastore.org/launchsettings.json",
  "profiles": {
    "http": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": true,
      "applicationUrl": "http://localhost:5320",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    },
    "https": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": true,
      "applicationUrl": "https://localhost:7331;http://localhost:5320",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

- [ ] **Step 10: Generate the initial migration**

```bash
cd services/billing-api/BillingApi
dotnet ef migrations add InitialCreate --output-dir Migrations
cd ../../..
```

- [ ] **Step 11: Test project (fixture only — no `[Fact]` tests, per the test-deferral policy)**

`services/billing-api/BillingApi.Tests/BillingApi.Tests.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="coverlet.collector" Version="6.0.2" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="9.0.0" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
  </ItemGroup>

  <ItemGroup>
    <Using Include="Xunit" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\BillingApi\BillingApi.csproj" />
  </ItemGroup>

</Project>
```

`services/billing-api/BillingApi.Tests/Fixtures/LocalDbTestFixture.cs`:

```csharp
using BillingApi.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BillingApi.Tests.Fixtures;

public class LocalDbTestFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _databaseName = $"BillingApiTest_{Guid.NewGuid():N}";

    public string ConnectionString =>
        $"Server=(localdb)\\MSSQLLocalDB;Database={_databaseName};Trusted_Connection=True;TrustServerCertificate=True;";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:BillingDb"] = ConnectionString
            });
        });
    }

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BillingDbContext>();
        await db.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BillingDbContext>();
        await db.Database.EnsureDeletedAsync();
        await base.DisposeAsync();
    }
}
```

- [ ] **Step 12: Register both projects in the solution**

```bash
dotnet sln AppointmentBooking.sln add services/billing-api/BillingApi/BillingApi.csproj
dotnet sln AppointmentBooking.sln add services/billing-api/BillingApi.Tests/BillingApi.Tests.csproj
```

- [ ] **Step 13: Build both projects**

```bash
dotnet build services/billing-api/BillingApi/BillingApi.csproj
dotnet build services/billing-api/BillingApi.Tests/BillingApi.Tests.csproj
```

Expected: 0 errors on both.

- [ ] **Step 14: Manual smoke check (not a unit test — a one-time verification that the new service actually runs)**

```bash
cd services/billing-api/BillingApi
dotnet run &
sleep 5
curl -s http://localhost:5320/health
kill %1
cd ../../..
```

Expected: the curl output is `{"status":"Healthy","service":"BillingApi"}`. This confirms the scaffold, DbContext, and migration all work end-to-end without writing a `[Fact]` test for it (consistent with the current test-deferral policy — this is a manual operational check, not test authorship).

- [ ] **Step 15: Commit**

```bash
git add services/billing-api AppointmentBooking.sln
git commit -m "feat(billing-api): scaffold new BillingApi service with Wallet and WalletTransaction (tests deferred to later pass)"
```

---

### Task 2: SchedulingApi — credit the parent's wallet on refund approval

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/Clients/IClientRecordsApiClient.cs`
- Create: `services/scheduling-api/SchedulingApi/Clients/IBillingApiClient.cs`
- Create: `services/scheduling-api/SchedulingApi/Clients/BillingApiClient.cs`
- Create: `services/scheduling-api/SchedulingApi.Tests/Fakes/FakeBillingApiClient.cs`
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/RefundRequestEndpoints.cs`
- Modify: `services/scheduling-api/SchedulingApi/Program.cs`
- Modify: `services/scheduling-api/SchedulingApi/appsettings.Development.json`

**Interfaces:**
- Consumes: `BillingApi`'s `POST /wallets/{parentId}/credit` (Task 1). `ClientRecordsApi`'s existing `GET /children/{id}` already returns `ParentId` in its JSON body (`ChildResponse.ParentId`, confirmed present) — only the `SchedulingApi`-side `ChildInfo` client model needs the new property to pick it up.
- Produces: `SchedulingApi`'s `POST /refund-requests/{id}/approve` now performs real wallet credit, non-fail-open (see Global Constraints).

- [ ] **Step 1: Add `ParentId` to the `ChildInfo` client model**

In `services/scheduling-api/SchedulingApi/Clients/IClientRecordsApiClient.cs`, add the new property to the existing `ChildInfo` class (leave `RemoteClientStatus` and the interface itself unchanged):

```csharp
public class ChildInfo
{
    public Guid Id { get; set; }
    public Guid ParentId { get; set; }
    public RemoteClientStatus Status { get; set; }
}
```

No change needed to `ClientRecordsApiClient.cs` itself — it deserializes the full JSON response with `JsonSerializerDefaults.Web`, and `ClientRecordsApi`'s `ChildResponse` already includes `ParentId`, so the new property is picked up automatically.

- [ ] **Step 2: Create the BillingApi client abstraction**

`services/scheduling-api/SchedulingApi/Clients/IBillingApiClient.cs`:

```csharp
namespace SchedulingApi.Clients;

public interface IBillingApiClient
{
    Task<bool> CreditWalletAsync(Guid parentId, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey, Guid tenantId, CancellationToken cancellationToken = default);
}
```

`services/scheduling-api/SchedulingApi/Clients/BillingApiClient.cs`:

```csharp
using System.Net.Http.Json;

namespace SchedulingApi.Clients;

public class BillingApiClient(HttpClient httpClient) : IBillingApiClient
{
    public async Task<bool> CreditWalletAsync(Guid parentId, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/wallets/{parentId}/credit");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        request.Headers.Add("Idempotency-Key", idempotencyKey);
        request.Content = JsonContent.Create(new { amount, reason, relatedAppointmentId });

        try
        {
            var response = await httpClient.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException)
        {
            return false;
        }
    }
}
```

**This does NOT follow the platform's usual fail-open pattern.** `IsBranchClosedAsync`/`IsTherapistOnLeaveAsync` return `null` on failure and callers treat `null` as "couldn't check, proceed anyway." `CreditWalletAsync` returns `false` on any failure (including the caught `HttpRequestException`), and Step 4 below treats `false` as a hard stop, never a pass-through. Do not change this to match the other clients' pattern — see this plan's Global Constraints.

- [ ] **Step 3: Fake for testing (infrastructure, not a test — allowed under the test-deferral policy)**

`services/scheduling-api/SchedulingApi.Tests/Fakes/FakeBillingApiClient.cs`:

```csharp
using SchedulingApi.Clients;

namespace SchedulingApi.Tests.Fakes;

public class FakeBillingApiClient : IBillingApiClient
{
    public bool CreditResult { get; set; } = true;

    public Task<bool> CreditWalletAsync(Guid parentId, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(CreditResult);
}
```

- [ ] **Step 4: Wire the approve handler**

In `services/scheduling-api/SchedulingApi/Endpoints/RefundRequestEndpoints.cs`, replace the entire existing `/{id:guid}/approve` handler:

```csharp
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
```

with this (note the added `HttpRequest httpRequest, IClientRecordsApiClient clientRecordsClient, IBillingApiClient billingClient, ITenantContext tenantContext` parameters):

```csharp
        group.MapPost("/{id:guid}/approve", async (Guid id, HttpRequest httpRequest, SchedulingDbContext db, IClientRecordsApiClient clientRecordsClient, IBillingApiClient billingClient, ITenantContext tenantContext) =>
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

            if (!httpRequest.Headers.TryGetValue("Idempotency-Key", out var idempotencyKeyValues) || string.IsNullOrWhiteSpace(idempotencyKeyValues.ToString()))
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Missing Idempotency-Key header", detail: "POST /refund-requests/{id}/approve requires an Idempotency-Key header.");
            }
            var idempotencyKey = idempotencyKeyValues.ToString()!;
            if (idempotencyKey.Length > 200)
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Idempotency-Key header is too long", detail: "Idempotency-Key must be 200 characters or fewer.");
            }

            Guid childId;
            if (refundRequest.AppointmentType == RefundRequestAppointmentType.TherapistAppointment)
            {
                var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == refundRequest.AppointmentId);
                if (appointment is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status502BadGateway, title: "Unable to resolve appointment", detail: "The appointment behind this refund request could no longer be found.");
                }
                childId = appointment.ChildId;
            }
            else
            {
                var doctorAppointment = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.Id == refundRequest.AppointmentId);
                if (doctorAppointment is null)
                {
                    return Results.Problem(statusCode: StatusCodes.Status502BadGateway, title: "Unable to resolve appointment", detail: "The appointment behind this refund request could no longer be found.");
                }
                childId = doctorAppointment.ChildId;
            }

            var child = await clientRecordsClient.GetChildAsync(childId, tenantContext.TenantId);
            if (child is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status502BadGateway, title: "Unable to resolve parent", detail: "Could not resolve the parent for this appointment's child record.");
            }

            var credited = await billingClient.CreditWalletAsync(
                child.ParentId,
                refundRequest.Amount,
                $"Refund approved for appointment {refundRequest.AppointmentId}",
                refundRequest.AppointmentId,
                idempotencyKey,
                tenantContext.TenantId);

            if (!credited)
            {
                return Results.Problem(statusCode: StatusCodes.Status502BadGateway, title: "Wallet credit failed", detail: "Could not credit the parent's wallet. The refund request remains pending — retry the approval.");
            }

            refundRequest.Status = RefundRequestStatus.Approved;
            refundRequest.ApprovedBy = "system";
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(refundRequest));
        });
```

The `reject` handler and every other endpoint in this file are unchanged.

- [ ] **Step 5: Register the new HttpClient in `Program.cs`**

In `services/scheduling-api/SchedulingApi/Program.cs`, add this block right after the existing `builder.Services.AddHttpClient<IClientRecordsApiClient, ClientRecordsApiClient>(...)` block:

```csharp
builder.Services.AddHttpClient<IBillingApiClient, BillingApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:BillingApiBaseUrl"]!);
});
```

- [ ] **Step 6: Add the base URL to config**

In `services/scheduling-api/SchedulingApi/appsettings.Development.json`, add `"BillingApiBaseUrl": "http://localhost:5320"` inside the existing `"Services"` object (alongside `DirectoryApiBaseUrl`/`ClientRecordsApiBaseUrl`).

- [ ] **Step 7: Build and run the existing test suite as a regression check**

Run: `dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: **this may show failures**, not necessarily a clean pass — any existing test that calls `POST /refund-requests/{id}/approve` will now fail because the test host has no real `IBillingApiClient`/`IClientRecordsApiClient` wired for that specific call path, or because the approve endpoint now requires an `Idempotency-Key` header the old test didn't send. Do not treat this as something to silently work around — read what actually fails:
  - A **compile break** (the test project fails to build) must be fixed — e.g. if a test fixture's service collection registration doesn't tolerate the new required services.
  - A **runtime failure** because a pre-existing test didn't anticipate the new cross-service call or new header requirement is a known, accepted gap under the test-deferral policy — do not add a new test to cover it, just confirm the failure is exactly that (a pre-existing test hitting the new behavior, not a logic bug in the new code) and note it precisely in your report; it will be picked up in the later consolidated test-writing pass.

- [ ] **Step 8: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Clients/IClientRecordsApiClient.cs services/scheduling-api/SchedulingApi/Clients/IBillingApiClient.cs services/scheduling-api/SchedulingApi/Clients/BillingApiClient.cs services/scheduling-api/SchedulingApi.Tests/Fakes/FakeBillingApiClient.cs services/scheduling-api/SchedulingApi/Endpoints/RefundRequestEndpoints.cs services/scheduling-api/SchedulingApi/Program.cs services/scheduling-api/SchedulingApi/appsettings.Development.json
git commit -m "feat(scheduling-api): credit parent wallet via BillingApi on refund approval (non-fail-open; tests deferred to later pass)"
```

---

## Definition of done for this plan

- [ ] `BillingApi` builds clean and its `/health` endpoint responds when run locally
- [ ] `dotnet build` succeeds with 0 errors on both `BillingApi` and the modified `SchedulingApi`
- [ ] `POST /refund-requests/{id}/approve` no longer flips `Status` to `Approved` unless the downstream wallet credit actually succeeded (`502` otherwise, status stays `Pending`)
- [ ] Both commits from this plan are present in `git log`
- [ ] **Test coverage for this sub-project remains outstanding** — tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier; flag it as the top priority for the eventual consolidated test pass given it's real money movement
- [ ] Phase 3's remaining two sub-projects (Payment Gateway Integration, Reports) are unblocked and can proceed independently
