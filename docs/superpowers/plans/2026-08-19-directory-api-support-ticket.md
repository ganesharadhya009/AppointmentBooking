# Directory API Support Ticket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add support tickets to `DirectoryApi` — one shared table for both parent-facing and therapist-facing queues, per the resolved service-placement decision in `docs/superpowers/specs/2026-08-19-activity-desk-remainder-design.md` §2. This is the last piece of Phase 2's backend scope.

**Architecture:** `SupportTicket` (tenant-scoped) with a `RequesterType` discriminator and a one-to-many `SupportTicketMessage` collection, following the same owned-collection pattern already used for `Therapist`/`TherapistAssignment`.

**Tech Stack:** .NET 9, EF Core 9.0.19 (already installed, no new packages).

## Global Constraints

- **Unit/integration test-writing is deferred to a later consolidated pass** (tracked as a 🔴 item in `DEFERRED-AND-TODO.md`) — this plan has no test-writing steps. Acceptance is: builds clean, existing suite passes unchanged.
- `SupportTicket` and `SupportTicketMessage` are both tenant-scoped: EF Core query filter + `HasIndex(TenantId)`.
- `RequesterId` is **not FK-validated** — deliberately, per the design spec §3: a `Parent` lives in a different service/database (can't validate same-service) and a `Therapist` could, but applying FK rigor to one requester type and not the other would be an inconsistent asymmetry.
- Adding a message flips `Status`: an `"Admin"` sender (case-insensitive) sets `WaitingForUserReply`; any other sender sets `WaitingForAdminReply`.
- Cannot add a message to a `Closed` ticket — `409 Conflict`.
- Every error response is RFC 7807.

---

### Task 1: SupportTicket and SupportTicketMessage

**Files:**
- Create: `services/directory-api/DirectoryApi/Entities/SupportTicket.cs`
- Modify: `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`
- Create: `services/directory-api/DirectoryApi/Dtos/SupportTicketDtos.cs`
- Create: `services/directory-api/DirectoryApi/Endpoints/SupportTicketEndpoints.cs`
- Modify: `services/directory-api/DirectoryApi/Program.cs`
- Create: `services/directory-api/DirectoryApi/Migrations/*`

**Interfaces:**
- Consumes: existing `DirectoryDbContext`, `PagedResult<T>`, `DataAnnotationsValidator`, `ITenantContext`
- Produces: `POST /support-tickets`, `GET /support-tickets`, `GET /support-tickets/{id}`, `POST /support-tickets/{id}/messages`, `POST /support-tickets/{id}/close`

- [ ] **Step 1: Create the entities**

`services/directory-api/DirectoryApi/Entities/SupportTicket.cs`:

```csharp
namespace DirectoryApi.Entities;

public enum SupportTicketRequesterType
{
    Parent,
    Therapist
}

public enum SupportTicketStatus
{
    WaitingForAdminReply,
    WaitingForUserReply,
    Closed
}

public class SupportTicket
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public SupportTicketRequesterType RequesterType { get; set; }
    public Guid RequesterId { get; set; }
    public required string Category { get; set; }
    public required string Title { get; set; }
    public SupportTicketStatus Status { get; set; } = SupportTicketStatus.WaitingForAdminReply;
    public DateTimeOffset CreatedAt { get; set; }

    public List<SupportTicketMessage> Messages { get; set; } = [];
}

public class SupportTicketMessage
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SupportTicketId { get; set; }
    public required string SenderType { get; set; }
    public required string Body { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 2: Register both entities in the DbContext**

Modify `services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs`. Add these two lines right after the existing `public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();`:

```csharp
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<SupportTicketMessage> SupportTicketMessages => Set<SupportTicketMessage>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<LeaveRequest>(l => { ... });` block:

```csharp
        modelBuilder.Entity<SupportTicket>(s =>
        {
            s.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            s.HasIndex(x => x.TenantId);
            s.Property(x => x.Category).HasMaxLength(200);
            s.Property(x => x.Title).HasMaxLength(200);
            s.HasMany(x => x.Messages)
                .WithOne()
                .HasForeignKey(m => m.SupportTicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SupportTicketMessage>(m =>
        {
            m.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            m.HasIndex(x => x.TenantId);
            m.Property(x => x.SenderType).HasMaxLength(50);
        });
```

- [ ] **Step 3: Create the DTOs**

`services/directory-api/DirectoryApi/Dtos/SupportTicketDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateSupportTicketRequest
{
    [Required]
    public SupportTicketRequesterType? RequesterType { get; set; }

    [Required]
    public Guid RequesterId { get; set; }

    [Required, MaxLength(200)]
    public required string Category { get; set; }

    [Required, MaxLength(200)]
    public required string Title { get; set; }
}

public class AddSupportTicketMessageRequest
{
    [Required, MaxLength(50)]
    public required string SenderType { get; set; }

    [Required]
    public required string Body { get; set; }
}

public class SupportTicketMessageResponse
{
    public Guid Id { get; set; }
    public required string SenderType { get; set; }
    public required string Body { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class SupportTicketResponse
{
    public Guid Id { get; set; }
    public SupportTicketRequesterType RequesterType { get; set; }
    public Guid RequesterId { get; set; }
    public required string Category { get; set; }
    public required string Title { get; set; }
    public SupportTicketStatus Status { get; set; }
    public List<SupportTicketMessageResponse> Messages { get; set; } = [];
}
```

- [ ] **Step 4: Implement the endpoints**

`services/directory-api/DirectoryApi/Endpoints/SupportTicketEndpoints.cs`:

```csharp
using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class SupportTicketEndpoints
{
    public static void MapSupportTicketEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/support-tickets");

        group.MapGet("", async (int? page, int? pageSize, SupportTicketRequesterType? requesterType, SupportTicketStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.SupportTickets.Include(t => t.Messages).AsQueryable();

            if (requesterType is not null)
            {
                query = query.Where(t => t.RequesterType == requesterType);
            }

            if (status is not null)
            {
                query = query.Where(t => t.Status == status);
            }

            query = query.OrderByDescending(t => t.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<SupportTicketResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var ticket = await db.SupportTickets.Include(t => t.Messages).FirstOrDefaultAsync(t => t.Id == id);
            return ticket is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Support ticket not found")
                : Results.Ok(ToResponse(ticket));
        });

        group.MapPost("", async (CreateSupportTicketRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var ticket = new SupportTicket
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                RequesterType = request.RequesterType!.Value,
                RequesterId = request.RequesterId,
                Category = request.Category,
                Title = request.Title,
                Status = SupportTicketStatus.WaitingForAdminReply,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.SupportTickets.Add(ticket);
            await db.SaveChangesAsync();

            return Results.Created($"/support-tickets/{ticket.Id}", ToResponse(ticket));
        });

        group.MapPost("/{id:guid}/messages", async (Guid id, AddSupportTicketMessageRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var ticket = await db.SupportTickets.Include(t => t.Messages).FirstOrDefaultAsync(t => t.Id == id);
            if (ticket is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Support ticket not found");
            }

            if (ticket.Status == SupportTicketStatus.Closed)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Support ticket is closed", detail: "Cannot add a message to a closed ticket.");
            }

            var message = new SupportTicketMessage
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                SupportTicketId = ticket.Id,
                SenderType = request.SenderType,
                Body = request.Body,
                CreatedAt = DateTimeOffset.UtcNow
            };

            ticket.Status = string.Equals(request.SenderType, "Admin", StringComparison.OrdinalIgnoreCase)
                ? SupportTicketStatus.WaitingForUserReply
                : SupportTicketStatus.WaitingForAdminReply;

            db.SupportTicketMessages.Add(message);
            await db.SaveChangesAsync();

            return Results.Created($"/support-tickets/{ticket.Id}", ToResponse(ticket));
        });

        group.MapPost("/{id:guid}/close", async (Guid id, DirectoryDbContext db) =>
        {
            var ticket = await db.SupportTickets.Include(t => t.Messages).FirstOrDefaultAsync(t => t.Id == id);
            if (ticket is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Support ticket not found");
            }

            ticket.Status = SupportTicketStatus.Closed;
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(ticket));
        });
    }

    private static SupportTicketResponse ToResponse(SupportTicket ticket) => new()
    {
        Id = ticket.Id,
        RequesterType = ticket.RequesterType,
        RequesterId = ticket.RequesterId,
        Category = ticket.Category,
        Title = ticket.Title,
        Status = ticket.Status,
        Messages = ticket.Messages
            .OrderBy(m => m.CreatedAt)
            .Select(m => new SupportTicketMessageResponse
            {
                Id = m.Id,
                SenderType = m.SenderType,
                Body = m.Body,
                CreatedAt = m.CreatedAt
            })
            .ToList()
    };
}
```

- [ ] **Step 5: Map the endpoints in `Program.cs`**

Add this line right after the existing `app.MapLeaveRequestEndpoints();` line in `services/directory-api/DirectoryApi/Program.cs`:

```csharp
app.MapSupportTicketEndpoints();
```

- [ ] **Step 6: Generate the migration**

```bash
cd services/directory-api/DirectoryApi
dotnet ef migrations add AddSupportTicket --output-dir Migrations
cd ../../..
```

- [ ] **Step 7: Build and run the existing test suite as a regression check**

Run: `dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj`
Expected: the existing test count, unchanged, 0 failures. This is a regression check, not new test-writing — do not add any `[Fact]` methods for `SupportTicket` itself.

- [ ] **Step 8: Commit**

```bash
git add services/directory-api/DirectoryApi/Entities/SupportTicket.cs services/directory-api/DirectoryApi/Data/DirectoryDbContext.cs services/directory-api/DirectoryApi/Dtos/SupportTicketDtos.cs services/directory-api/DirectoryApi/Endpoints/SupportTicketEndpoints.cs services/directory-api/DirectoryApi/Program.cs services/directory-api/DirectoryApi/Migrations
git commit -m "feat(directory-api): add SupportTicket with messages and status workflow (tests deferred to later pass)"
```

---

## Definition of done for this plan

- [ ] `dotnet build services/directory-api/DirectoryApi/DirectoryApi.csproj` succeeds with 0 errors
- [ ] `dotnet test services/directory-api/DirectoryApi.Tests/DirectoryApi.Tests.csproj` — existing suite passes unchanged (regression check only)
- [ ] Adding a message correctly flips `Status` based on `SenderType`; a `Closed` ticket rejects new messages with `409`
- [ ] The commit from this plan is present in `git log`
- [ ] **Test coverage for this sub-project remains outstanding** — tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier
- [ ] **This closes out Phase 2's backend scope** — Holiday, Enquiry, Consultant Catalog, Doctor Appointment Booking, Leave Request, Refund Request, Support Ticket all complete
