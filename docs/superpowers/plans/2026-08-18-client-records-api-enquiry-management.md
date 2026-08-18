# Client Records API Enquiry Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pre-sales lead intake (`Enquiry`) to `ClientRecordsApi`, with draft/submitted states and a one-action conversion into a real `Parent`+`Child`.

**Architecture:** `Enquiry` is a new tenant-scoped entity alongside the existing `Parent`/`Child`, in the same `ClientRecordsDbContext` — no cross-service calls needed anywhere in this plan, since conversion creates records in the same database.

**Tech Stack:** .NET 9, EF Core 9.0.19 (already installed, no new packages).

## Global Constraints

- `Enquiry` is tenant-scoped: EF Core query filter + `HasIndex(TenantId)` — the established convention.
- `Enquiry.ChildDateOfBirth` is `DateOnly?` (nullable) even though it's conceptually required at submission — a `Draft` is allowed to be incomplete; the requirement is enforced at conversion time instead, not via `[Required]` on the type.
- `Enquiry.Concerns` (`List<string>`) is the first primitive-collection property in this codebase — persisted via an EF Core `ValueConverter` (JSON-serialized) with an explicit `ValueComparer`, required for EF Core to correctly detect in-place mutations to the list.
- `Status` can only be set to `Draft` or `Submitted` via `POST`/`PUT` — setting `Converted` directly is rejected; only `POST /enquiries/{id}/convert` may transition to `Converted`.
- A `Converted` enquiry cannot be edited (`PUT` returns `409`) or converted again (`convert` returns `409`).
- The convert action stages `Parent`+`Child`+`Enquiry` changes and commits them in one `SaveChangesAsync()` call — no explicit transaction/execution-strategy handling needed (no multi-step external call or optimistic-conflict retry occurs in this operation, unlike Scheduling's booking path).
- Every error response is RFC 7807 via `Results.Problem(...)`/`Results.ValidationProblem(...)`.

---

### Task 1: Enquiry entity, CRUD, and the Concerns value converter

**Files:**
- Create: `services/client-records-api/ClientRecordsApi/Entities/Enquiry.cs`
- Modify: `services/client-records-api/ClientRecordsApi/Data/ClientRecordsDbContext.cs`
- Create: `services/client-records-api/ClientRecordsApi/Dtos/EnquiryDtos.cs`
- Create: `services/client-records-api/ClientRecordsApi/Endpoints/EnquiryEndpoints.cs`
- Modify: `services/client-records-api/ClientRecordsApi/Program.cs`
- Create: `services/client-records-api/ClientRecordsApi/Migrations/*`
- Test: `services/client-records-api/ClientRecordsApi.Tests/EnquiryEndpointsTests.cs`

**Interfaces:**
- Consumes: existing `ClientRecordsDbContext`, `PagedResult<T>`, `DataAnnotationsValidator`, `ITenantContext`
- Produces: `POST /enquiries`, `GET /enquiries`, `GET /enquiries/{id}`, `PUT /enquiries/{id}` — the `Enquiry` entity and `EnquiryStatus` enum are consumed by Task 2's convert endpoint

- [ ] **Step 1: Create the entity**

`services/client-records-api/ClientRecordsApi/Entities/Enquiry.cs`:

```csharp
namespace ClientRecordsApi.Entities;

public enum EnquiryStatus
{
    Draft,
    Submitted,
    Converted
}

public class Enquiry
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string ParentName { get; set; }
    public required string ParentMobileNumber { get; set; }
    public string? ParentEmail { get; set; }
    public required string ChildName { get; set; }
    public DateOnly? ChildDateOfBirth { get; set; }
    public string? ChildGender { get; set; }
    public string? PreferredTherapy { get; set; }
    public string? PreferredLocation { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public List<string> Concerns { get; set; } = [];
    public string? DiagnosisReportUrl { get; set; }
    public string? ParentIdCardUrl { get; set; }
    public EnquiryStatus Status { get; set; } = EnquiryStatus.Draft;
    public DateTimeOffset? FollowUpDate { get; set; }
    public Guid? ConvertedParentId { get; set; }
    public Guid? ConvertedChildId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public required string CreatedBy { get; set; }
}
```

- [ ] **Step 2: Register the entity, including the Concerns value converter**

Modify `services/client-records-api/ClientRecordsApi/Data/ClientRecordsDbContext.cs`. Add `using System.Text.Json;`, `using Microsoft.EntityFrameworkCore.ChangeTracking;`, and `using Microsoft.EntityFrameworkCore.Storage.ValueConversion;` to the top of the file.

Add this line right after the existing `public DbSet<Child> Children => Set<Child>();`:

```csharp
    public DbSet<Enquiry> Enquiries => Set<Enquiry>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<Child>(c => { ... });` block:

```csharp
        var concernsConverter = new ValueConverter<List<string>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>());
        var concernsComparer = new ValueComparer<List<string>>(
            (c1, c2) => (c1 ?? new List<string>()).SequenceEqual(c2 ?? new List<string>()),
            c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
            c => c.ToList());

        modelBuilder.Entity<Enquiry>(e =>
        {
            e.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            e.HasIndex(x => x.TenantId);
            e.Property(x => x.ParentName).HasMaxLength(200);
            e.Property(x => x.ParentMobileNumber).HasMaxLength(20);
            e.Property(x => x.ParentEmail).HasMaxLength(200);
            e.Property(x => x.ChildName).HasMaxLength(200);
            e.Property(x => x.ChildGender).HasMaxLength(20);
            e.Property(x => x.PreferredTherapy).HasMaxLength(200);
            e.Property(x => x.PreferredLocation).HasMaxLength(200);
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.City).HasMaxLength(100);
            e.Property(x => x.State).HasMaxLength(100);
            e.Property(x => x.Country).HasMaxLength(100);
            e.Property(x => x.Concerns)
                .HasConversion(concernsConverter)
                .HasColumnType("nvarchar(max)")
                .Metadata.SetValueComparer(concernsComparer);
        });
```

The `ValueComparer` is required — without it, EF Core's change tracker cannot detect in-place mutations to the `List<string>` (e.g. adding an item and calling `SaveChangesAsync()` without reassigning the property) and would silently fail to persist the change. This is the first primitive-collection property in this codebase; get this exactly right rather than skipping it because "it looks optional."

- [ ] **Step 3: Create the DTOs**

`services/client-records-api/ClientRecordsApi/Dtos/EnquiryDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using ClientRecordsApi.Entities;

namespace ClientRecordsApi.Dtos;

public class CreateEnquiryRequest
{
    [Required, MaxLength(200)]
    public required string ParentName { get; set; }

    [Required, MaxLength(20)]
    public required string ParentMobileNumber { get; set; }

    [MaxLength(200)]
    public string? ParentEmail { get; set; }

    [Required, MaxLength(200)]
    public required string ChildName { get; set; }

    public DateOnly? ChildDateOfBirth { get; set; }

    [MaxLength(20)]
    public string? ChildGender { get; set; }

    [MaxLength(200)]
    public string? PreferredTherapy { get; set; }

    [MaxLength(200)]
    public string? PreferredLocation { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }

    [MaxLength(6)]
    public List<string> Concerns { get; set; } = [];

    public string? DiagnosisReportUrl { get; set; }
    public string? ParentIdCardUrl { get; set; }
    public EnquiryStatus? Status { get; set; }
    public DateTimeOffset? FollowUpDate { get; set; }
}

public class UpdateEnquiryRequest : CreateEnquiryRequest
{
}

public class EnquiryResponse
{
    public Guid Id { get; set; }
    public required string ParentName { get; set; }
    public required string ParentMobileNumber { get; set; }
    public string? ParentEmail { get; set; }
    public required string ChildName { get; set; }
    public DateOnly? ChildDateOfBirth { get; set; }
    public string? ChildGender { get; set; }
    public string? PreferredTherapy { get; set; }
    public string? PreferredLocation { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public List<string> Concerns { get; set; } = [];
    public string? DiagnosisReportUrl { get; set; }
    public string? ParentIdCardUrl { get; set; }
    public EnquiryStatus Status { get; set; }
    public DateTimeOffset? FollowUpDate { get; set; }
    public Guid? ConvertedParentId { get; set; }
    public Guid? ConvertedChildId { get; set; }
}
```

`[MaxLength(6)]` on `Concerns` (a `List<string>`) validates the collection's item count via `DataAnnotationsValidator` — `MaxLengthAttribute` supports `ICollection` for this purpose, not just strings.

- [ ] **Step 4: Implement the CRUD endpoints**

`services/client-records-api/ClientRecordsApi/Endpoints/EnquiryEndpoints.cs`:

```csharp
using ClientRecordsApi.Common;
using ClientRecordsApi.Data;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tenancy;
using ClientRecordsApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace ClientRecordsApi.Endpoints;

public static class EnquiryEndpoints
{
    public static void MapEnquiryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/enquiries");

        group.MapGet("", async (int? page, int? pageSize, EnquiryStatus? status, DateTimeOffset? from, DateTimeOffset? to, string? contactNumber, ClientRecordsDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Enquiries.AsQueryable();

            if (status is not null)
            {
                query = query.Where(e => e.Status == status);
            }

            if (from is not null)
            {
                query = query.Where(e => e.CreatedAt >= from);
            }

            if (to is not null)
            {
                query = query.Where(e => e.CreatedAt <= to);
            }

            if (!string.IsNullOrWhiteSpace(contactNumber))
            {
                query = query.Where(e => e.ParentMobileNumber == contactNumber);
            }

            query = query.OrderByDescending(e => e.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<EnquiryResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var enquiry = await db.Enquiries.FirstOrDefaultAsync(e => e.Id == id);
            return enquiry is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Enquiry not found")
                : Results.Ok(ToResponse(enquiry));
        });

        group.MapPost("", async (CreateEnquiryRequest request, ClientRecordsDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (request.Status == EnquiryStatus.Converted)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["status"] = ["An enquiry cannot be created with Converted status."]
                });
            }

            var enquiry = new Enquiry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ParentName = request.ParentName,
                ParentMobileNumber = request.ParentMobileNumber,
                ParentEmail = request.ParentEmail,
                ChildName = request.ChildName,
                ChildDateOfBirth = request.ChildDateOfBirth,
                ChildGender = request.ChildGender,
                PreferredTherapy = request.PreferredTherapy,
                PreferredLocation = request.PreferredLocation,
                Address = request.Address,
                City = request.City,
                State = request.State,
                Country = request.Country,
                Concerns = request.Concerns,
                DiagnosisReportUrl = request.DiagnosisReportUrl,
                ParentIdCardUrl = request.ParentIdCardUrl,
                Status = request.Status ?? EnquiryStatus.Draft,
                FollowUpDate = request.FollowUpDate,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            db.Enquiries.Add(enquiry);
            await db.SaveChangesAsync();

            return Results.Created($"/enquiries/{enquiry.Id}", ToResponse(enquiry));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateEnquiryRequest request, ClientRecordsDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var enquiry = await db.Enquiries.FirstOrDefaultAsync(e => e.Id == id);
            if (enquiry is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Enquiry not found");
            }

            if (enquiry.Status == EnquiryStatus.Converted)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Enquiry already converted", detail: "A converted enquiry cannot be edited.");
            }

            if (request.Status == EnquiryStatus.Converted)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["status"] = ["Use POST /enquiries/{id}/convert to convert an enquiry; status cannot be set to Converted directly."]
                });
            }

            enquiry.ParentName = request.ParentName;
            enquiry.ParentMobileNumber = request.ParentMobileNumber;
            enquiry.ParentEmail = request.ParentEmail;
            enquiry.ChildName = request.ChildName;
            enquiry.ChildDateOfBirth = request.ChildDateOfBirth;
            enquiry.ChildGender = request.ChildGender;
            enquiry.PreferredTherapy = request.PreferredTherapy;
            enquiry.PreferredLocation = request.PreferredLocation;
            enquiry.Address = request.Address;
            enquiry.City = request.City;
            enquiry.State = request.State;
            enquiry.Country = request.Country;
            enquiry.Concerns = request.Concerns;
            enquiry.DiagnosisReportUrl = request.DiagnosisReportUrl;
            enquiry.ParentIdCardUrl = request.ParentIdCardUrl;
            enquiry.FollowUpDate = request.FollowUpDate;
            if (request.Status is not null)
            {
                enquiry.Status = request.Status.Value;
            }

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(enquiry));
        });
    }

    private static EnquiryResponse ToResponse(Enquiry enquiry) => new()
    {
        Id = enquiry.Id,
        ParentName = enquiry.ParentName,
        ParentMobileNumber = enquiry.ParentMobileNumber,
        ParentEmail = enquiry.ParentEmail,
        ChildName = enquiry.ChildName,
        ChildDateOfBirth = enquiry.ChildDateOfBirth,
        ChildGender = enquiry.ChildGender,
        PreferredTherapy = enquiry.PreferredTherapy,
        PreferredLocation = enquiry.PreferredLocation,
        Address = enquiry.Address,
        City = enquiry.City,
        State = enquiry.State,
        Country = enquiry.Country,
        Concerns = enquiry.Concerns,
        DiagnosisReportUrl = enquiry.DiagnosisReportUrl,
        ParentIdCardUrl = enquiry.ParentIdCardUrl,
        Status = enquiry.Status,
        FollowUpDate = enquiry.FollowUpDate,
        ConvertedParentId = enquiry.ConvertedParentId,
        ConvertedChildId = enquiry.ConvertedChildId
    };
}
```

- [ ] **Step 5: Map the endpoints in `Program.cs`**

Add this line right after the existing `app.MapChildEndpoints();` line in `services/client-records-api/ClientRecordsApi/Program.cs`:

```csharp
app.MapEnquiryEndpoints();
```

- [ ] **Step 6: Write the tests**

`services/client-records-api/ClientRecordsApi.Tests/EnquiryEndpointsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using ClientRecordsApi.Common;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tests.Fixtures;
using Xunit;

namespace ClientRecordsApi.Tests;

public class EnquiryEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public EnquiryEndpointsTests(LocalDbTestFixture fixture)
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

    private static CreateEnquiryRequest ValidRequest() => new()
    {
        ParentName = "Test Parent",
        ParentMobileNumber = "9999999999",
        ParentEmail = "parent@example.com",
        ChildName = "Test Child",
        ChildDateOfBirth = new DateOnly(2020, 1, 1),
        Concerns = ["Speech delay", "Motor skills"]
    };

    [Fact]
    public async Task PostEnquiry_WithoutStatus_DefaultsToDraft()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var body = await response.Content.ReadFromJsonAsync<EnquiryResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(EnquiryStatus.Draft, body!.Status);
        Assert.Equal(2, body.Concerns.Count);
    }

    [Fact]
    public async Task PostEnquiry_WithConvertedStatus_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var request = ValidRequest();
        request.Status = EnquiryStatus.Converted;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, request));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetEnquiryById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantA, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/enquiries/{created!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutEnquiry_UpdatesConcernsList_RoundTripsCorrectly()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var updateRequest = ValidRequest();
        updateRequest.Concerns = ["Updated concern only"];
        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/enquiries/{created!.Id}", tenantId, updateRequest));
        var putBody = await putResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);
        Assert.Single(putBody!.Concerns);
        Assert.Equal("Updated concern only", putBody.Concerns[0]);
    }

    [Fact]
    public async Task PutEnquiry_SettingStatusToConvertedDirectly_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var updateRequest = ValidRequest();
        updateRequest.Status = EnquiryStatus.Converted;
        var response = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/enquiries/{created!.Id}", tenantId, updateRequest));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetEnquiries_FilteredByStatusAndContactNumber_ReturnsOnlyMatching()
    {
        var tenantId = Guid.NewGuid();
        var matching = ValidRequest();
        matching.ParentMobileNumber = "8888888888";
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, matching));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            "/enquiries?status=Draft&contactNumber=8888888888", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<EnquiryResponse>>();

        Assert.Single(body!.Items);
        Assert.Equal("8888888888", body.Items[0].ParentMobileNumber);
    }
}
```

- [ ] **Step 7: Generate the migration**

```bash
cd services/client-records-api/ClientRecordsApi
dotnet ef migrations add AddEnquiry --output-dir Migrations
cd ../../..
```

- [ ] **Step 8: Run the tests and verify they pass**

Run: `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 9: Commit**

```bash
git add services/client-records-api/ClientRecordsApi/Entities/Enquiry.cs services/client-records-api/ClientRecordsApi/Data/ClientRecordsDbContext.cs services/client-records-api/ClientRecordsApi/Dtos/EnquiryDtos.cs services/client-records-api/ClientRecordsApi/Endpoints/EnquiryEndpoints.cs services/client-records-api/ClientRecordsApi/Program.cs services/client-records-api/ClientRecordsApi/Migrations services/client-records-api/ClientRecordsApi.Tests/EnquiryEndpointsTests.cs
git commit -m "feat(client-records-api): add Enquiry entity with CRUD"
```

---

### Task 2: Convert an enquiry into a Parent + Child

**Files:**
- Modify: `services/client-records-api/ClientRecordsApi/Dtos/EnquiryDtos.cs`
- Modify: `services/client-records-api/ClientRecordsApi/Endpoints/EnquiryEndpoints.cs`
- Test: `services/client-records-api/ClientRecordsApi.Tests/EnquiryEndpointsTests.cs`

**Interfaces:**
- Consumes: `Enquiry`, `EnquiryStatus` (Task 1); existing `Parent`, `Child`, `ClientStatus` entities
- Produces: `POST /enquiries/{id}/convert`

- [ ] **Step 1: Add the convert response DTO**

Add to `services/client-records-api/ClientRecordsApi/Dtos/EnquiryDtos.cs` (append below `EnquiryResponse`):

```csharp
public class ConvertEnquiryResponse
{
    public Guid EnquiryId { get; set; }
    public Guid ParentId { get; set; }
    public Guid ChildId { get; set; }
}
```

- [ ] **Step 2: Implement the convert endpoint**

`using ClientRecordsApi.Entities;` is already present in `EnquiryEndpoints.cs` from Task 1 — no new usings needed since `Parent`/`Child`/`ClientStatus` are in the same `ClientRecordsApi.Entities` namespace.

Add this route inside `MapEnquiryEndpoints`, right after the existing `group.MapPut("/{id:guid}", ...)` block's closing `});`:

```csharp
        group.MapPost("/{id:guid}/convert", async (Guid id, ClientRecordsDbContext db, ITenantContext tenantContext) =>
        {
            var enquiry = await db.Enquiries.FirstOrDefaultAsync(e => e.Id == id);
            if (enquiry is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Enquiry not found");
            }

            if (enquiry.Status == EnquiryStatus.Converted)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Enquiry already converted", detail: "This enquiry has already been converted to a client.");
            }

            if (string.IsNullOrWhiteSpace(enquiry.ParentEmail))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["parentEmail"] = ["Parent email is required before an enquiry can be converted."]
                });
            }

            if (enquiry.ChildDateOfBirth is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["childDateOfBirth"] = ["Child date of birth is required before an enquiry can be converted."]
                });
            }

            var parent = new Parent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = enquiry.ParentName,
                MobileNumber = enquiry.ParentMobileNumber,
                Email = enquiry.ParentEmail!,
                Address = enquiry.Address,
                City = enquiry.City,
                State = enquiry.State,
                Country = enquiry.Country,
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            var child = new Child
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ParentId = parent.Id,
                Name = enquiry.ChildName,
                DateOfBirth = enquiry.ChildDateOfBirth!.Value,
                Gender = enquiry.ChildGender,
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            enquiry.Status = EnquiryStatus.Converted;
            enquiry.ConvertedParentId = parent.Id;
            enquiry.ConvertedChildId = child.Id;

            db.Parents.Add(parent);
            db.Children.Add(child);
            await db.SaveChangesAsync();

            return Results.Ok(new ConvertEnquiryResponse
            {
                EnquiryId = enquiry.Id,
                ParentId = parent.Id,
                ChildId = child.Id
            });
        });
```

`Parent.Email` and `Child.DateOfBirth` are non-nullable (`required string`/`DateOnly`) on their entities, but `Enquiry.ParentEmail`/`ChildDateOfBirth` are nullable — the two `ValidationProblem` checks above guarantee non-null values before construction, so the `!` null-forgiving operators are safe at the assignment sites.

- [ ] **Step 3: Write the failing tests**

Add to `services/client-records-api/ClientRecordsApi.Tests/EnquiryEndpointsTests.cs` (append to the existing class):

```csharp
    [Fact]
    public async Task ConvertEnquiry_CreatesExactlyOneParentAndChild()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var convertResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created!.Id}/convert", tenantId));
        var convertBody = await convertResponse.Content.ReadFromJsonAsync<ConvertEnquiryResponse>();

        Assert.Equal(HttpStatusCode.OK, convertResponse.StatusCode);

        var parentResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/parents/{convertBody!.ParentId}", tenantId));
        var parentBody = await parentResponse.Content.ReadFromJsonAsync<ParentResponse>();
        Assert.Equal(HttpStatusCode.OK, parentResponse.StatusCode);
        Assert.Equal("Test Parent", parentBody!.Name);

        var childResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/children/{convertBody.ChildId}", tenantId));
        var childBody = await childResponse.Content.ReadFromJsonAsync<ChildResponse>();
        Assert.Equal(HttpStatusCode.OK, childResponse.StatusCode);
        Assert.Equal("Test Child", childBody!.Name);

        var enquiryResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/enquiries/{created.Id}", tenantId));
        var enquiryBody = await enquiryResponse.Content.ReadFromJsonAsync<EnquiryResponse>();
        Assert.Equal(EnquiryStatus.Converted, enquiryBody!.Status);
        Assert.Equal(convertBody.ParentId, enquiryBody.ConvertedParentId);
        Assert.Equal(convertBody.ChildId, enquiryBody.ConvertedChildId);
    }

    [Fact]
    public async Task ConvertEnquiry_CalledTwice_SecondCallReturns409()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created!.Id}/convert", tenantId));

        var secondConvert = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created.Id}/convert", tenantId));

        Assert.Equal(HttpStatusCode.Conflict, secondConvert.StatusCode);
    }

    [Fact]
    public async Task ConvertEnquiry_WithoutChildDateOfBirth_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var request = ValidRequest();
        request.ChildDateOfBirth = null;
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, request));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var convertResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created!.Id}/convert", tenantId));

        Assert.Equal(HttpStatusCode.BadRequest, convertResponse.StatusCode);
    }

    [Fact]
    public async Task PutEnquiry_OnAConvertedEnquiry_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created!.Id}/convert", tenantId));

        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/enquiries/{created.Id}", tenantId, ValidRequest()));

        Assert.Equal(HttpStatusCode.Conflict, putResponse.StatusCode);
    }
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj`
Expected: 0 failures — trust the test runner's own total.

- [ ] **Step 5: Commit**

```bash
git add services/client-records-api/ClientRecordsApi/Dtos/EnquiryDtos.cs services/client-records-api/ClientRecordsApi/Endpoints/EnquiryEndpoints.cs services/client-records-api/ClientRecordsApi.Tests/EnquiryEndpointsTests.cs
git commit -m "feat(client-records-api): add enquiry-to-client conversion"
```

---

## Definition of done for this plan

- [ ] `dotnet test services/client-records-api/ClientRecordsApi.Tests/ClientRecordsApi.Tests.csproj` passes with 0 failures
- [ ] `Enquiry` CRUD works with tenant isolation, matching every prior sub-project's coverage
- [ ] `Concerns` round-trips correctly through the JSON value converter, including mutation after load
- [ ] `Status` cannot be set to `Converted` via `POST`/`PUT` — only via `POST /enquiries/{id}/convert`
- [ ] Convert creates exactly one `Parent`+`Child` pair with correctly mapped fields, and a second convert attempt returns `409`
- [ ] Every commit from this plan is present in `git log`
