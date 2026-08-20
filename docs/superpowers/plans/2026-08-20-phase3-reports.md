# Phase 3 Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the report endpoints scoped in `docs/superpowers/specs/2026-08-20-phase3-reports-design.md` — this closes Phase 3's backend scope. Task 1 covers `SchedulingApi` (appointment filters + two new report endpoints), Task 2 covers `BillingApi` (a tenant-wide wallet transaction list + date filters on the payment-checkout list).

**Architecture:** Pure additive `GET` endpoints and query-parameter enhancements to existing list endpoints. No new persisted entities, no write paths, no cross-service calls.

**Tech Stack:** .NET 9, EF Core 9.0.19. No new packages.

## Global Constraints

- **Review mode: single sonnet-tier reviewer per task, no separate final whole-branch review** — per the 2026-08-20 cost checkpoint. This is the lowest-risk Phase 3 sub-project: read-only, no money movement, no new writes.
- **Unit/integration test-writing is deferred to a later consolidated pass** (standing project policy). No new `[Fact]` tests in this plan. Acceptance per task: builds clean, existing suite passes unchanged.
- Every new/enhanced endpoint stays tenant-scoped exactly as today — all reads already go through each `DbContext`'s existing `HasQueryFilter`, so no explicit `TenantId` filtering is needed in the new query code (adding one would be redundant, not a bug, but isn't required).
- All new query parameters are optional; omitting all of them must reproduce the exact current behavior of the endpoint being enhanced (no default date range, no default status filter).
- Every error response is RFC 7807 (pagination edge cases only — no other validation surface in this plan).

---

### Task 1: `SchedulingApi` — appointment filters + unified/cancellation reports

**Files:**
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`
- Modify: `services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`
- Create: `services/scheduling-api/SchedulingApi/Endpoints/AppointmentReportEndpoints.cs`
- Create: `services/scheduling-api/SchedulingApi/Dtos/AppointmentReportDtos.cs`
- Modify: `services/scheduling-api/SchedulingApi/Program.cs`

**Interfaces:**
- Produces: enhanced `GET /appointments` and `GET /doctor-appointments` (backward-compatible), new `GET /appointments/reports/unified`, new `GET /appointments/reports/cancellations`.

- [ ] **Step 1: Add filters to `GET /appointments`**

In `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`, replace this block:

```csharp
        group.MapGet("", async (int? page, int? pageSize, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Appointments.OrderByDescending(a => a.AppointmentDate).ThenByDescending(a => a.CreatedAt).ThenBy(a => a.Id);
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
```

with:

```csharp
        group.MapGet("", async (int? page, int? pageSize, DateOnly? dateFrom, DateOnly? dateTo, Guid? branchId, AppointmentStatus? status, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var filtered = db.Appointments.AsQueryable();
            if (dateFrom is not null)
            {
                filtered = filtered.Where(a => a.AppointmentDate >= dateFrom.Value);
            }
            if (dateTo is not null)
            {
                filtered = filtered.Where(a => a.AppointmentDate <= dateTo.Value);
            }
            if (branchId is not null)
            {
                filtered = filtered.Where(a => a.BranchId == branchId.Value);
            }
            if (status is not null)
            {
                filtered = filtered.Where(a => a.Status == status.Value);
            }

            var query = filtered.OrderByDescending(a => a.AppointmentDate).ThenByDescending(a => a.CreatedAt).ThenBy(a => a.Id);
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
```

- [ ] **Step 2: Add filters to `GET /doctor-appointments`**

In `services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs`, replace this block:

```csharp
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
```

with:

```csharp
        group.MapGet("", async (int? page, int? pageSize, DateOnly? dateFrom, DateOnly? dateTo, AppointmentStatus? status, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var filtered = db.DoctorAppointments.AsQueryable();
            if (dateFrom is not null)
            {
                filtered = filtered.Where(a => a.AppointmentDate >= dateFrom.Value);
            }
            if (dateTo is not null)
            {
                filtered = filtered.Where(a => a.AppointmentDate <= dateTo.Value);
            }
            if (status is not null)
            {
                filtered = filtered.Where(a => a.Status == status.Value);
            }

            var query = filtered.OrderByDescending(a => a.AppointmentDate).ThenByDescending(a => a.CreatedAt).ThenBy(a => a.Id);
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
```

- [ ] **Step 3: Create the report DTOs**

`services/scheduling-api/SchedulingApi/Dtos/AppointmentReportDtos.cs`:

```csharp
using SchedulingApi.Entities;

namespace SchedulingApi.Dtos;

public enum AppointmentKind
{
    Therapist,
    Doctor
}

public class UnifiedAppointmentResponse
{
    public Guid Id { get; set; }
    public AppointmentKind Kind { get; set; }
    public Guid ChildId { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public decimal Amount { get; set; }
    public AppointmentStatus Status { get; set; }

    // Therapist-only (null when Kind == Doctor)
    public Guid? BranchId { get; set; }
    public Guid? TherapistId { get; set; }
    public Guid? TherapyTypeId { get; set; }

    // Doctor-only (null when Kind == Therapist)
    public Guid? ConsultantDoctorId { get; set; }
    public Guid? ConsultantClinicId { get; set; }
}

public class ChildCancellationSummary
{
    public Guid ChildId { get; set; }
    public int CancellationCount { get; set; }
}
```

- [ ] **Step 4: Implement the report endpoints**

`services/scheduling-api/SchedulingApi/Endpoints/AppointmentReportEndpoints.cs`:

```csharp
using SchedulingApi.Common;
using SchedulingApi.Data;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Endpoints;

public static class AppointmentReportEndpoints
{
    public static void MapAppointmentReportEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/appointments/reports");

        group.MapGet("/unified", async (int? page, int? pageSize, DateOnly? dateFrom, DateOnly? dateTo, AppointmentStatus? status, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var therapistQuery = db.Appointments.AsQueryable();
            var doctorQuery = db.DoctorAppointments.AsQueryable();

            if (dateFrom is not null)
            {
                therapistQuery = therapistQuery.Where(a => a.AppointmentDate >= dateFrom.Value);
                doctorQuery = doctorQuery.Where(a => a.AppointmentDate >= dateFrom.Value);
            }
            if (dateTo is not null)
            {
                therapistQuery = therapistQuery.Where(a => a.AppointmentDate <= dateTo.Value);
                doctorQuery = doctorQuery.Where(a => a.AppointmentDate <= dateTo.Value);
            }
            if (status is not null)
            {
                therapistQuery = therapistQuery.Where(a => a.Status == status.Value);
                doctorQuery = doctorQuery.Where(a => a.Status == status.Value);
            }

            // Merged in memory rather than a SQL-level UNION -- acceptable at current scale (see
            // design spec §3); a genuinely large dataset would need a different query shape.
            var therapistItems = await therapistQuery.ToListAsync();
            var doctorItems = await doctorQuery.ToListAsync();

            var merged = therapistItems.Select(ToUnifiedResponse)
                .Concat(doctorItems.Select(ToUnifiedResponse))
                .OrderByDescending(x => x.AppointmentDate)
                .ThenBy(x => x.Id)
                .ToList();

            var totalCount = merged.Count;
            var items = merged.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToList();

            return Results.Ok(new PagedResult<UnifiedAppointmentResponse>
            {
                Items = items,
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/cancellations", async (int? page, int? pageSize, Guid? branchId, bool? groupByChild, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Appointments.Where(a => a.Status == AppointmentStatus.Cancelled);
            if (branchId is not null)
            {
                query = query.Where(a => a.BranchId == branchId.Value);
            }

            if (groupByChild == true)
            {
                var grouped = await query
                    .GroupBy(a => a.ChildId)
                    .Select(g => new ChildCancellationSummary { ChildId = g.Key, CancellationCount = g.Count() })
                    .OrderByDescending(x => x.CancellationCount)
                    .ToListAsync();

                var totalGroupCount = grouped.Count;
                var groupItems = grouped.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToList();

                return Results.Ok(new PagedResult<ChildCancellationSummary>
                {
                    Items = groupItems,
                    Page = currentPage,
                    PageSize = currentPageSize,
                    TotalCount = totalGroupCount
                });
            }

            var ordered = query.OrderByDescending(a => a.AppointmentDate).ThenBy(a => a.Id);
            var totalCount = await ordered.CountAsync();
            var items = await ordered.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<AppointmentResponse>
            {
                Items = items.Select(AppointmentEndpointsResponseAdapter.ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });
    }

    private static UnifiedAppointmentResponse ToUnifiedResponse(Appointment a) => new()
    {
        Id = a.Id,
        Kind = AppointmentKind.Therapist,
        ChildId = a.ChildId,
        AppointmentDate = a.AppointmentDate,
        Amount = a.PricePerSession,
        Status = a.Status,
        BranchId = a.BranchId,
        TherapistId = a.TherapistId,
        TherapyTypeId = a.TherapyTypeId
    };

    private static UnifiedAppointmentResponse ToUnifiedResponse(DoctorAppointment a) => new()
    {
        Id = a.Id,
        Kind = AppointmentKind.Doctor,
        ChildId = a.ChildId,
        AppointmentDate = a.AppointmentDate,
        Amount = a.ConsultationFee,
        Status = a.Status,
        ConsultantDoctorId = a.ConsultantDoctorId,
        ConsultantClinicId = a.ConsultantClinicId
    };
}
```

**Important — `AppointmentEndpointsResponseAdapter.ToResponse` does not exist yet; you must create it.** `AppointmentEndpoints.cs`'s existing `ToResponse(Appointment)` mapper is a `private static` method on the `AppointmentEndpoints` class, so `AppointmentReportEndpoints.cs` cannot call it directly. Rather than duplicating that mapping logic, in `services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs`, change the existing method's access modifier from `private` to `internal` (same file, same assembly — `internal` is the minimal visibility change needed, not `public`), and add a one-line adapter class at the bottom of `AppointmentReportEndpoints.cs`:

```csharp
internal static class AppointmentEndpointsResponseAdapter
{
    public static AppointmentResponse ToResponse(Appointment appointment) => AppointmentEndpoints.ToResponse(appointment);
}
```

Find this line in `AppointmentEndpoints.cs`:

```csharp
    private static AppointmentResponse ToResponse(Appointment appointment) => new()
```

and change it to:

```csharp
    internal static AppointmentResponse ToResponse(Appointment appointment) => new()
```

- [ ] **Step 5: Wire the new endpoints into `Program.cs`**

In `services/scheduling-api/SchedulingApi/Program.cs`, add this line right after the existing `app.MapRefundRequestEndpoints();` line:

```csharp
app.MapAppointmentReportEndpoints();
```

- [ ] **Step 6: Build and run the existing test suite as a regression check**

Run: `dotnet build services/scheduling-api/SchedulingApi/SchedulingApi.csproj`
Expected: 0 errors.

Run: `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj`
Expected: 49/49 passing, unchanged — the filter additions are purely additive (all new query params optional, omitting them reproduces prior behavior exactly), so no existing test should be affected.

- [ ] **Step 7: Commit**

```bash
git add services/scheduling-api/SchedulingApi/Endpoints/AppointmentEndpoints.cs services/scheduling-api/SchedulingApi/Endpoints/DoctorAppointmentEndpoints.cs services/scheduling-api/SchedulingApi/Endpoints/AppointmentReportEndpoints.cs services/scheduling-api/SchedulingApi/Dtos/AppointmentReportDtos.cs services/scheduling-api/SchedulingApi/Program.cs
git commit -m "feat(scheduling-api): add date/branch/status filters to appointment lists, unified and cancellation reports (tests deferred to later pass)"
```

---

### Task 2: `BillingApi` — tenant-wide wallet transaction list + payment-checkout date filters

**Files:**
- Modify: `services/billing-api/BillingApi/Endpoints/WalletEndpoints.cs`
- Modify: `services/billing-api/BillingApi/Endpoints/PaymentCheckoutEndpoints.cs`

**Interfaces:**
- Produces: new `GET /wallets/transactions` (tenant-wide), enhanced `GET /payment-checkouts` (adds `dateFrom`/`dateTo`).

- [ ] **Step 1: Add the tenant-wide wallet transaction list endpoint**

In `services/billing-api/BillingApi/Endpoints/WalletEndpoints.cs`, add this new route registration inside `MapWalletEndpoints`, right after the existing `group.MapGet("/{parentId:guid}/transactions", ...)` block's closing `});`:

```csharp
        group.MapGet("/transactions", async (int? page, int? pageSize, DateTimeOffset? dateFrom, DateTimeOffset? dateTo, WalletTransactionType? type, Guid? parentId, BillingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.WalletTransactions.AsQueryable();
            if (dateFrom is not null)
            {
                query = query.Where(t => t.CreatedAt >= dateFrom.Value);
            }
            if (dateTo is not null)
            {
                query = query.Where(t => t.CreatedAt <= dateTo.Value);
            }
            if (type is not null)
            {
                query = query.Where(t => t.Type == type.Value);
            }
            if (parentId is not null)
            {
                var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.ParentId == parentId.Value);
                query = wallet is null ? query.Where(t => false) : query.Where(t => t.WalletId == wallet.Id);
            }

            query = query.OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id);

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
```

Note the route is `/transactions` under the `/wallets` group, i.e. `GET /wallets/transactions` — this must be registered so it does not collide with the existing `GET /{parentId:guid}` route. ASP.NET Core Minimal API routing resolves `/wallets/transactions` against `/wallets/{parentId:guid}` correctly because `:guid` route constraints reject the literal string `transactions` (it isn't a valid `Guid`), so both routes coexist safely — confirm this by testing `GET /wallets/transactions` actually reaches the new handler in Step 3, not the `{parentId:guid}` one.

This reuses the existing private `ToTransactionResponse` mapper already in this file — no new mapping code needed.

- [ ] **Step 2: Add date-range filters to `GET /payment-checkouts`**

In `services/billing-api/BillingApi/Endpoints/PaymentCheckoutEndpoints.cs`, replace this block:

```csharp
        group.MapGet("", async (int? page, int? pageSize, PaymentGatewayTransactionStatus? status, Guid? parentId, BillingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.PaymentGatewayTransactions.AsQueryable();
            if (status is not null)
            {
                query = query.Where(t => t.Status == status);
            }
            if (parentId is not null)
            {
                query = query.Where(t => t.ParentId == parentId);
            }
            query = query.OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<PaymentCheckoutResponse>
            {
                Items = items.Select(t => ToResponse(t)).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });
```

with:

```csharp
        group.MapGet("", async (int? page, int? pageSize, PaymentGatewayTransactionStatus? status, Guid? parentId, DateTimeOffset? dateFrom, DateTimeOffset? dateTo, BillingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.PaymentGatewayTransactions.AsQueryable();
            if (status is not null)
            {
                query = query.Where(t => t.Status == status);
            }
            if (parentId is not null)
            {
                query = query.Where(t => t.ParentId == parentId);
            }
            if (dateFrom is not null)
            {
                query = query.Where(t => t.CreatedAt >= dateFrom.Value);
            }
            if (dateTo is not null)
            {
                query = query.Where(t => t.CreatedAt <= dateTo.Value);
            }
            query = query.OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<PaymentCheckoutResponse>
            {
                Items = items.Select(t => ToResponse(t)).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });
```

- [ ] **Step 3: Build and manually verify the new route doesn't collide, then smoke-check**

Run: `dotnet build services/billing-api/BillingApi/BillingApi.csproj`
Expected: 0 errors.

```bash
cd services/billing-api/BillingApi
dotnet run &
sleep 5
curl -s http://localhost:5320/health
echo ""
curl -s -w "\nHTTP:%{http_code}\n" http://localhost:5320/wallets/transactions -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111"
kill %1
cd ../../..
```

Expected: `/health` returns the usual healthy body; `/wallets/transactions` returns `HTTP:200` with an empty `PagedResult` (`"totalCount":0`) — confirming it reaches the new handler and not a `404`/`400` from the `{parentId:guid}` route misfiring on the literal string `transactions`.

- [ ] **Step 4: Commit**

```bash
git add services/billing-api/BillingApi/Endpoints/WalletEndpoints.cs services/billing-api/BillingApi/Endpoints/PaymentCheckoutEndpoints.cs
git commit -m "feat(billing-api): add tenant-wide wallet transaction list and date filters on payment-checkout list (tests deferred to later pass)"
```

---

## Definition of done for this plan

- [ ] `dotnet build` succeeds with 0 errors on both `SchedulingApi` and `BillingApi`
- [ ] `dotnet test services/scheduling-api/SchedulingApi.Tests/SchedulingApi.Tests.csproj` — 49/49 passing, unchanged
- [ ] `GET /wallets/transactions` reaches the new handler, verified not to collide with `GET /wallets/{parentId:guid}`
- [ ] Both commits from this plan are present in `git log`
- [ ] **Test coverage for this sub-project remains outstanding** — tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier
- [ ] **This closes Phase 3's backend scope** (Wallet Foundation, Payment Gateway Integration, Reports all complete) — three items explicitly deferred (OTP audit, therapist progress report, appointment reschedule log) are documented in `DEFERRED-AND-TODO.md` as follow-ups once their underlying features exist
