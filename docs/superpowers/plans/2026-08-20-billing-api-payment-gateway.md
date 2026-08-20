# BillingApi Payment Gateway Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parent-initiated, gateway-simulated wallet top-up flow to `BillingApi` — `PaymentGatewayTransaction`, an `IPaymentGatewayClient` abstraction with a stub implementation, and a webhook-style callback that credits the wallet on success. Based on `docs/superpowers/specs/2026-08-20-billing-api-payment-gateway-design.md`.

**Architecture:** Task 1 extracts the already-reviewed atomic wallet-credit logic out of `WalletEndpoints.cs`'s `POST /credit` handler into a reusable `WalletCreditService`, with no behavior change. Task 2 adds the new payment-checkout feature, whose callback-on-success path calls that same shared service instead of duplicating money-movement logic.

**Tech Stack:** .NET 9, EF Core 9.0.19. No new packages.

## Global Constraints

- **Review mode: single sonnet-tier reviewer per task, no separate final whole-branch review** — per the 2026-08-20 cost checkpoint. This sub-project reuses already-hardened money-movement logic (Task 1 is a pure extraction, verified to be behavior-preserving; Task 2's only new money-movement call is through that same shared, already-reviewed service) and the gateway is an in-process stub with no real external dependency — it is not a new risk surface.
- **Unit/integration test-writing is deferred to a later consolidated pass** (standing project policy). No new `[Fact]` tests in this plan. Acceptance per task: builds clean, existing suite passes unchanged.
- Task 1 must not change `POST /{parentId}/credit`'s or `POST /{parentId}/debit`'s observable behavior in any way — it is a refactor, not a feature change. If a reviewer finds any behavioral difference, that's a real defect to fix, not an acceptable side effect.
- `PaymentGatewayTransaction` is tenant-scoped: EF Core query filter + `HasIndex(TenantId)`.
- `PaymentGatewayTransaction.ParentId` is **not FK-validated**, same reasoning as `Wallet.ParentId`.
- The callback endpoint is idempotent via the transaction's own `Status` (only `Initiated` is ever processed) — no `Idempotency-Key` header on this endpoint, unlike every other write endpoint on the platform. This is deliberate (§6 of the spec): it is the inbound target of a webhook a real gateway may redeliver, not an outbound call this platform retries.
- Every error response is RFC 7807.

---

### Task 1: Extract `WalletCreditService` (pure refactor, no behavior change)

**Files:**
- Create: `services/billing-api/BillingApi/Services/WalletTransactionHelpers.cs`
- Create: `services/billing-api/BillingApi/Services/WalletCreditService.cs`
- Modify: `services/billing-api/BillingApi/Endpoints/WalletEndpoints.cs`
- Modify: `services/billing-api/BillingApi/Program.cs`

**Interfaces:**
- Produces: `WalletCreditService.CreditAsync(Guid tenantId, Guid parentId, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey) : Task<WalletCreditResult>`, consumed by Task 2's callback handler. `WalletTransactionHelpers.IsUniqueViolation`/`BuildTransaction`/`FindIdempotencyMismatchAsync`, consumed by both `WalletCreditService` and the (unchanged-in-behavior) debit handler in `WalletEndpoints.cs`.

- [ ] **Step 1: Create the shared static helpers (moved verbatim out of `WalletEndpoints.cs`, no logic change)**

`services/billing-api/BillingApi/Services/WalletTransactionHelpers.cs`:

```csharp
using BillingApi.Data;
using BillingApi.Entities;
using Microsoft.EntityFrameworkCore;

namespace BillingApi.Services;

// Moved out of WalletEndpoints.cs (BillingApi Wallet Foundation sub-project) so both the
// credit path (via WalletCreditService) and the debit endpoint can share them without
// duplication. No logic change from the original private methods.
public static class WalletTransactionHelpers
{
    public static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };

    public static WalletTransaction BuildTransaction(Guid tenantId, Guid walletId, WalletTransactionType type, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        WalletId = walletId,
        Type = type,
        Amount = amount,
        RelatedAppointmentId = relatedAppointmentId,
        Reason = reason,
        IdempotencyKey = idempotencyKey,
        CreatedAt = DateTimeOffset.UtcNow
    };

    // A replayed idempotency key must be verified against the wallet/type/amount actually being
    // requested before its stored transaction is handed back -- otherwise a reused key could return
    // an unrelated stored transaction (e.g. a credit for a different parent) as if it were this
    // request's result. Returns a 409 IResult on mismatch, or null when the stored transaction is a
    // legitimate replay of this exact request.
    public static async Task<IResult?> FindIdempotencyMismatchAsync(BillingDbContext db, WalletTransaction stored, Guid parentId, WalletTransactionType expectedType, decimal expectedAmount)
    {
        var storedWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.Id == stored.WalletId);
        var matches = storedWallet is not null
            && storedWallet.ParentId == parentId
            && stored.Type == expectedType
            && stored.Amount == expectedAmount;

        return matches
            ? null
            : Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Idempotency key reused for a different request",
                detail: "This Idempotency-Key was already used for a different wallet/amount/operation.");
    }
}
```

- [ ] **Step 2: Create `WalletCreditService` (the credit handler's exact logic, extracted)**

`services/billing-api/BillingApi/Services/WalletCreditService.cs`:

```csharp
using BillingApi.Data;
using BillingApi.Entities;
using Microsoft.EntityFrameworkCore;

namespace BillingApi.Services;

public class WalletCreditResult
{
    public bool Success { get; init; }
    public WalletTransaction? Transaction { get; init; }
    public IResult? Error { get; init; }
}

// Extracted from WalletEndpoints' original POST /{parentId}/credit handler (BillingApi Wallet
// Foundation sub-project, 2026-08-19/20 review -- see that sub-project's review history for why
// this exact shape: atomic ExecuteUpdateAsync balance updates, execution-strategy-safe
// transactions, idempotency-replay-with-match-checking, and a wallet-creation-race retry were all
// added there in response to real money-safety bugs found in review). Extracted here, unchanged,
// so the Payment Gateway Integration sub-project's checkout-success callback can reuse this exact
// logic instead of reimplementing money-movement logic from scratch.
public class WalletCreditService(BillingDbContext db)
{
    public async Task<WalletCreditResult> CreditAsync(Guid tenantId, Guid parentId, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey)
    {
        var existing = await db.WalletTransactions.AsNoTracking().FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
        if (existing is not null)
        {
            var existingMismatch = await WalletTransactionHelpers.FindIdempotencyMismatchAsync(db, existing, parentId, WalletTransactionType.Credit, amount);
            return existingMismatch is not null
                ? new WalletCreditResult { Success = false, Error = existingMismatch }
                : new WalletCreditResult { Success = true, Transaction = existing };
        }

        IResult? conflict = null;
        WalletTransaction? committed = null;

        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();

            await using var transaction = await db.Database.BeginTransactionAsync();

            var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.ParentId == parentId);
            Guid walletId;

            if (wallet is null)
            {
                var newWallet = new Wallet
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    ParentId = parentId,
                    Balance = amount,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                db.Wallets.Add(newWallet);
                walletId = newWallet.Id;
            }
            else
            {
                walletId = wallet.Id;
                await db.Wallets.Where(w => w.Id == walletId)
                    .ExecuteUpdateAsync(s => s.SetProperty(w => w.Balance, w => w.Balance + amount));
            }

            var newTransaction = WalletTransactionHelpers.BuildTransaction(tenantId, walletId, WalletTransactionType.Credit, amount, reason, relatedAppointmentId, idempotencyKey);
            db.WalletTransactions.Add(newTransaction);

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (WalletTransactionHelpers.IsUniqueViolation(ex))
            {
                await transaction.RollbackAsync();
                db.ChangeTracker.Clear();

                var raced = await db.WalletTransactions.AsNoTracking().FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
                if (raced is not null)
                {
                    var racedMismatch = await WalletTransactionHelpers.FindIdempotencyMismatchAsync(db, raced, parentId, WalletTransactionType.Credit, amount);
                    conflict = racedMismatch;
                    committed = racedMismatch is null ? raced : null;
                    return;
                }

                var raceWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.ParentId == parentId);
                if (raceWallet is null)
                {
                    conflict = Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Concurrent credit conflict", detail: "Please retry the request.");
                    return;
                }

                await using var retryTransaction = await db.Database.BeginTransactionAsync();

                await db.Wallets.Where(w => w.Id == raceWallet.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(w => w.Balance, w => w.Balance + amount));

                var retryCredit = WalletTransactionHelpers.BuildTransaction(tenantId, raceWallet.Id, WalletTransactionType.Credit, amount, reason, relatedAppointmentId, idempotencyKey);
                db.WalletTransactions.Add(retryCredit);

                try
                {
                    await db.SaveChangesAsync();
                    await retryTransaction.CommitAsync();
                    committed = retryCredit;
                }
                catch (DbUpdateException retryEx) when (WalletTransactionHelpers.IsUniqueViolation(retryEx))
                {
                    await retryTransaction.RollbackAsync();
                    conflict = Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Concurrent credit conflict", detail: "Please retry the request.");
                }

                return;
            }

            await transaction.CommitAsync();
            committed = newTransaction;
        });

        return conflict is not null
            ? new WalletCreditResult { Success = false, Error = conflict }
            : new WalletCreditResult { Success = true, Transaction = committed };
    }
}
```

- [ ] **Step 3: Simplify `WalletEndpoints.cs`'s credit handler to call the new service; point the debit handler at the moved-out helpers**

In `services/billing-api/BillingApi/Endpoints/WalletEndpoints.cs`, replace this entire block (the current `POST /{parentId:guid}/credit` handler, from `group.MapPost("/{parentId:guid}/credit", ...)` through its closing `});`):

```csharp
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

            var amount = request.Amount!.Value;

            var existing = await db.WalletTransactions.AsNoTracking().FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
            if (existing is not null)
            {
                var mismatch = await FindIdempotencyMismatchAsync(db, existing, parentId, WalletTransactionType.Credit, amount);
                return mismatch ?? Results.Ok(ToTransactionResponse(existing));
            }

            IResult? conflict = null;
            WalletTransaction? committed = null;

            // Wrapped through the DbContext's execution strategy (rather than a bare
            // BeginTransactionAsync) because the SqlServer provider is configured with
            // EnableRetryOnFailure() — a retrying execution strategy refuses user-initiated
            // transactions started any other way. The transaction and all reads/writes that
            // must be atomic with it live inside this delegate so a retried attempt after a
            // transient fault starts from fresh, actually-committed state.
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();

                await using var transaction = await db.Database.BeginTransactionAsync();

                var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.ParentId == parentId);
                Guid walletId;

                if (wallet is null)
                {
                    // Nothing to race against yet on a row that doesn't exist — the
                    // (TenantId, ParentId) unique index backstops concurrent double-creation,
                    // handled below in the unique-violation catch.
                    var newWallet = new Wallet
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantContext.TenantId,
                        ParentId = parentId,
                        Balance = amount,
                        CreatedAt = DateTimeOffset.UtcNow
                    };
                    db.Wallets.Add(newWallet);
                    walletId = newWallet.Id;
                }
                else
                {
                    walletId = wallet.Id;
                    // Atomic, single-statement balance update — pushes the addition into the SQL
                    // statement itself instead of read-modify-write in memory, so two concurrent
                    // credits against the same existing wallet both apply instead of one racing
                    // and silently overwriting the other's in-memory read.
                    await db.Wallets.Where(w => w.Id == walletId)
                        .ExecuteUpdateAsync(s => s.SetProperty(w => w.Balance, w => w.Balance + amount));
                }

                var newTransaction = BuildTransaction(tenantContext.TenantId, walletId, WalletTransactionType.Credit, amount, request.Reason, request.RelatedAppointmentId, idempotencyKey!);
                db.WalletTransactions.Add(newTransaction);

                try
                {
                    await db.SaveChangesAsync();
                }
                catch (DbUpdateException ex) when (IsUniqueViolation(ex))
                {
                    await transaction.RollbackAsync();
                    db.ChangeTracker.Clear();

                    var raced = await db.WalletTransactions.AsNoTracking().FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
                    if (raced is not null)
                    {
                        var mismatch = await FindIdempotencyMismatchAsync(db, raced, parentId, WalletTransactionType.Credit, amount);
                        conflict = mismatch;
                        committed = mismatch is null ? raced : null;
                        return;
                    }

                    // No transaction row with this idempotency key exists, so the unique-index
                    // violation must be the (TenantId, ParentId) wallet-creation race: two
                    // concurrent first-credits for the same brand-new parent. Safe to retry once —
                    // the wallet now exists (created by the other request), so redo the credit as
                    // an atomic update against it instead of surfacing a 409 and losing this credit.
                    var raceWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.ParentId == parentId);
                    if (raceWallet is null)
                    {
                        conflict = Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Concurrent credit conflict", detail: "Please retry the request.");
                        return;
                    }

                    await using var retryTransaction = await db.Database.BeginTransactionAsync();

                    await db.Wallets.Where(w => w.Id == raceWallet.Id)
                        .ExecuteUpdateAsync(s => s.SetProperty(w => w.Balance, w => w.Balance + amount));

                    var retryCredit = BuildTransaction(tenantContext.TenantId, raceWallet.Id, WalletTransactionType.Credit, amount, request.Reason, request.RelatedAppointmentId, idempotencyKey!);
                    db.WalletTransactions.Add(retryCredit);

                    try
                    {
                        await db.SaveChangesAsync();
                        await retryTransaction.CommitAsync();
                        committed = retryCredit;
                    }
                    catch (DbUpdateException retryEx) when (IsUniqueViolation(retryEx))
                    {
                        await retryTransaction.RollbackAsync();
                        conflict = Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Concurrent credit conflict", detail: "Please retry the request.");
                    }

                    return;
                }

                await transaction.CommitAsync();
                committed = newTransaction;
            });

            return conflict ?? Results.Ok(ToTransactionResponse(committed!));
        });
```

with this (`ITenantContext tenantContext` and `WalletCreditService creditService` replace the old `BillingDbContext db, ITenantContext tenantContext` pair — note `tenantContext` stays, `db` is no longer needed directly in this handler):

```csharp
        group.MapPost("/{parentId:guid}/credit", async (Guid parentId, CreditWalletRequest request, HttpRequest httpRequest, WalletCreditService creditService, ITenantContext tenantContext) =>
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

            var result = await creditService.CreditAsync(tenantContext.TenantId, parentId, request.Amount!.Value, request.Reason, request.RelatedAppointmentId, idempotencyKey!);
            return result.Success ? Results.Ok(ToTransactionResponse(result.Transaction!)) : result.Error!;
        });
```

Next, in the same file, add `using BillingApi.Services;` to the top of the `using` block (alongside the existing `using BillingApi.Common;` etc.).

Then, still in the same file, add the two moved-out helper methods back as thin wrappers so the **debit** handler (unchanged, still calls `IsUniqueViolation`, `BuildTransaction`, `FindIdempotencyMismatchAsync` by their original short names) keeps compiling without editing the debit handler's body at all. At the bottom of the file, replace this:

```csharp
    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };

    private static WalletTransaction BuildTransaction(Guid tenantId, Guid walletId, WalletTransactionType type, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        WalletId = walletId,
        Type = type,
        Amount = amount,
        RelatedAppointmentId = relatedAppointmentId,
        Reason = reason,
        IdempotencyKey = idempotencyKey,
        CreatedAt = DateTimeOffset.UtcNow
    };
```

with this:

```csharp
    private static bool IsUniqueViolation(DbUpdateException ex) => WalletTransactionHelpers.IsUniqueViolation(ex);

    private static WalletTransaction BuildTransaction(Guid tenantId, Guid walletId, WalletTransactionType type, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey) =>
        WalletTransactionHelpers.BuildTransaction(tenantId, walletId, type, amount, reason, relatedAppointmentId, idempotencyKey);
```

And replace this (the `FindIdempotencyMismatchAsync` private method, still used by the unchanged debit handler):

```csharp
    private static async Task<IResult?> FindIdempotencyMismatchAsync(BillingDbContext db, WalletTransaction stored, Guid parentId, WalletTransactionType expectedType, decimal expectedAmount)
    {
        var storedWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.Id == stored.WalletId);
        var matches = storedWallet is not null
            && storedWallet.ParentId == parentId
            && stored.Type == expectedType
            && stored.Amount == expectedAmount;

        return matches
            ? null
            : Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Idempotency key reused for a different request",
                detail: "This Idempotency-Key was already used for a different wallet/amount/operation.");
    }
```

with this:

```csharp
    private static Task<IResult?> FindIdempotencyMismatchAsync(BillingDbContext db, WalletTransaction stored, Guid parentId, WalletTransactionType expectedType, decimal expectedAmount) =>
        WalletTransactionHelpers.FindIdempotencyMismatchAsync(db, stored, parentId, expectedType, expectedAmount);
```

**Do not touch the `POST /{parentId:guid}/debit` handler's body at all** — it keeps calling `IsUniqueViolation`, `BuildTransaction`, `FindIdempotencyMismatchAsync` by their short names, which now just forward to `WalletTransactionHelpers`. This keeps the debit handler's diff to zero lines changed, which is the point: this task changes nothing about debit's behavior or its code.

- [ ] **Step 4: Register `WalletCreditService` in `Program.cs`**

In `services/billing-api/BillingApi/Program.cs`, add this line right after the existing `builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());` line:

```csharp
builder.Services.AddScoped<BillingApi.Services.WalletCreditService>();
```

- [ ] **Step 5: Build and run the manual smoke check as a regression check**

Run: `dotnet build services/billing-api/BillingApi/BillingApi.csproj`
Expected: 0 errors.

Run the same manual smoke check as the original Wallet Foundation plan (start the service, `GET /health`) to confirm nothing is broken at the DI/startup level:

```bash
cd services/billing-api/BillingApi
dotnet run &
sleep 5
curl -s http://localhost:5320/health
kill %1
cd ../../..
```

Expected: `{"status":"Healthy","service":"BillingApi"}`. There is no automated test suite exercising `POST /credit`/`POST /debit` yet (tracked as a known gap in `DEFERRED-AND-TODO.md`), so this smoke check plus a careful code-level review (Task 1's reviewer should diff the extracted code against the original line-for-line and confirm zero logic drift) is this task's verification.

- [ ] **Step 6: Commit**

```bash
git add services/billing-api/BillingApi/Services services/billing-api/BillingApi/Endpoints/WalletEndpoints.cs services/billing-api/BillingApi/Program.cs
git commit -m "refactor(billing-api): extract WalletCreditService for reuse by payment-checkout callback (no behavior change)"
```

---

### Task 2: `PaymentGatewayTransaction`, `IPaymentGatewayClient` stub, checkout endpoints

**Files:**
- Create: `services/billing-api/BillingApi/Entities/PaymentGatewayTransaction.cs`
- Create: `services/billing-api/BillingApi/Clients/IPaymentGatewayClient.cs`
- Create: `services/billing-api/BillingApi/Clients/StubPaymentGatewayClient.cs`
- Create: `services/billing-api/BillingApi/Dtos/PaymentCheckoutDtos.cs`
- Create: `services/billing-api/BillingApi/Endpoints/PaymentCheckoutEndpoints.cs`
- Modify: `services/billing-api/BillingApi/Data/BillingDbContext.cs`
- Modify: `services/billing-api/BillingApi/Program.cs`
- Create: `services/billing-api/BillingApi/Migrations/*`

**Interfaces:**
- Consumes: `WalletCreditService.CreditAsync(...)` from Task 1.
- Produces: `POST /payment-checkouts`, `GET /payment-checkouts`, `GET /payment-checkouts/{id}`, `POST /payment-checkouts/{id}/callback`.

- [ ] **Step 1: Create the entity**

`services/billing-api/BillingApi/Entities/PaymentGatewayTransaction.cs`:

```csharp
namespace BillingApi.Entities;

public enum PaymentRail
{
    Card,
    Netbanking,
    Wallet,
    Upi,
    NeftRtgs
}

public enum PaymentGatewayTransactionStatus
{
    Initiated,
    Success,
    Failed
}

public class PaymentGatewayTransaction
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ParentId { get; set; }
    public decimal Amount { get; set; }
    public PaymentRail Rail { get; set; }
    public PaymentGatewayTransactionStatus Status { get; set; } = PaymentGatewayTransactionStatus.Initiated;
    public required string MerchantReference { get; set; }
    public string? RawGatewayPayload { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
```

- [ ] **Step 2: Create the gateway abstraction and stub implementation**

`services/billing-api/BillingApi/Clients/IPaymentGatewayClient.cs`:

```csharp
using BillingApi.Entities;

namespace BillingApi.Clients;

public class GatewayCheckoutSession
{
    public required string MerchantReference { get; set; }
    public required string CheckoutUrl { get; set; }
}

public interface IPaymentGatewayClient
{
    Task<GatewayCheckoutSession> InitiateCheckoutAsync(Guid transactionId, decimal amount, PaymentRail rail, CancellationToken cancellationToken = default);
}
```

`services/billing-api/BillingApi/Clients/StubPaymentGatewayClient.cs`:

```csharp
using BillingApi.Entities;

namespace BillingApi.Clients;

// The only implementation of IPaymentGatewayClient for now -- a real provider (Razorpay, Stripe,
// CCAvenue, etc.) is a future swap-in via DI (see Program.cs), not part of this sub-project. See
// docs/superpowers/specs/2026-08-20-billing-api-payment-gateway-design.md §5. Entirely in-process,
// no real HTTP call anywhere, no external dependency, no API keys.
public class StubPaymentGatewayClient : IPaymentGatewayClient
{
    public Task<GatewayCheckoutSession> InitiateCheckoutAsync(Guid transactionId, decimal amount, PaymentRail rail, CancellationToken cancellationToken = default)
    {
        var merchantReference = $"STUB-{Guid.NewGuid():N}";
        return Task.FromResult(new GatewayCheckoutSession
        {
            MerchantReference = merchantReference,
            CheckoutUrl = $"https://stub-gateway.local/checkout/{merchantReference}"
        });
    }
}
```

- [ ] **Step 3: Register the new entities in `BillingDbContext`**

Modify `services/billing-api/BillingApi/Data/BillingDbContext.cs`. Add this line right after the existing `public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();`:

```csharp
    public DbSet<PaymentGatewayTransaction> PaymentGatewayTransactions => Set<PaymentGatewayTransaction>();
```

Add this block inside `OnModelCreating`, right after the existing `modelBuilder.Entity<WalletTransaction>(t => { ... });` block (before the closing brace of `OnModelCreating`):

```csharp
        modelBuilder.Entity<PaymentGatewayTransaction>(p =>
        {
            p.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            p.HasIndex(x => x.TenantId);
            p.HasIndex(x => x.ParentId);
            p.Property(x => x.Amount).HasColumnType("decimal(10,2)");
            p.Property(x => x.MerchantReference).HasMaxLength(200);
        });
```

- [ ] **Step 4: Create the DTOs**

`services/billing-api/BillingApi/Dtos/PaymentCheckoutDtos.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using BillingApi.Entities;

namespace BillingApi.Dtos;

public class CreatePaymentCheckoutRequest
{
    [Required]
    public Guid ParentId { get; set; }

    [Required]
    [Range(typeof(decimal), "0.01", "99999999.99")]
    public decimal? Amount { get; set; }

    [Required]
    public PaymentRail? Rail { get; set; }
}

public class PaymentCheckoutCallbackRequest
{
    [Required]
    public PaymentGatewayTransactionStatus? Status { get; set; }

    public string? RawPayload { get; set; }
}

public class PaymentCheckoutResponse
{
    public Guid Id { get; set; }
    public Guid ParentId { get; set; }
    public decimal Amount { get; set; }
    public PaymentRail Rail { get; set; }
    public PaymentGatewayTransactionStatus Status { get; set; }
    public required string MerchantReference { get; set; }
    public string? CheckoutUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
```

Note: `PaymentCheckoutCallbackRequest.Status` only accepts `Success`/`Failed` in practice — `Initiated` is a valid enum value but not a meaningful callback outcome. Validate this explicitly in the endpoint handler (Step 5), not via a data annotation (there's no built-in "exclude one enum member" attribute; a manual check keeps this simple).

- [ ] **Step 5: Implement the endpoints**

`services/billing-api/BillingApi/Endpoints/PaymentCheckoutEndpoints.cs`:

```csharp
using BillingApi.Clients;
using BillingApi.Common;
using BillingApi.Data;
using BillingApi.Dtos;
using BillingApi.Entities;
using BillingApi.Services;
using BillingApi.Tenancy;
using BillingApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace BillingApi.Endpoints;

public static class PaymentCheckoutEndpoints
{
    public static void MapPaymentCheckoutEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/payment-checkouts");

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

        group.MapGet("/{id:guid}", async (Guid id, BillingDbContext db) =>
        {
            var checkout = await db.PaymentGatewayTransactions.FirstOrDefaultAsync(t => t.Id == id);
            return checkout is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Payment checkout not found")
                : Results.Ok(ToResponse(checkout));
        });

        group.MapPost("", async (CreatePaymentCheckoutRequest request, BillingDbContext db, IPaymentGatewayClient gatewayClient, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var checkout = new PaymentGatewayTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ParentId = request.ParentId,
                Amount = request.Amount!.Value,
                Rail = request.Rail!.Value,
                Status = PaymentGatewayTransactionStatus.Initiated,
                MerchantReference = string.Empty,
                CreatedAt = DateTimeOffset.UtcNow
            };

            var session = await gatewayClient.InitiateCheckoutAsync(checkout.Id, checkout.Amount, checkout.Rail);
            checkout.MerchantReference = session.MerchantReference;

            db.PaymentGatewayTransactions.Add(checkout);
            await db.SaveChangesAsync();

            return Results.Created($"/payment-checkouts/{checkout.Id}", ToResponse(checkout, session.CheckoutUrl));
        });

        group.MapPost("/{id:guid}/callback", async (Guid id, PaymentCheckoutCallbackRequest request, BillingDbContext db, WalletCreditService creditService, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (request.Status == PaymentGatewayTransactionStatus.Initiated)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Callback status must be Success or Failed."] });
            }

            var checkout = await db.PaymentGatewayTransactions.FirstOrDefaultAsync(t => t.Id == id);
            if (checkout is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Payment checkout not found");
            }

            // Idempotent by the transaction's own state, not a header: this endpoint is the inbound
            // target of a webhook a real gateway may legitimately redeliver. A terminal-state
            // transaction is returned as-is, never reprocessed -- this is what prevents a
            // redelivered "Success" callback from crediting the wallet twice.
            if (checkout.Status != PaymentGatewayTransactionStatus.Initiated)
            {
                return Results.Ok(ToResponse(checkout));
            }

            if (request.Status == PaymentGatewayTransactionStatus.Failed)
            {
                checkout.Status = PaymentGatewayTransactionStatus.Failed;
                checkout.RawGatewayPayload = request.RawPayload;
                checkout.CompletedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync();
                return Results.Ok(ToResponse(checkout));
            }

            // Success path: same local database, so this can be one straightforward atomic
            // transaction -- no cross-service call, so none of the non-fail-open machinery the
            // refund-approval flow needed (that flow calls out to a different service's database).
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync();

                var freshCheckout = await db.PaymentGatewayTransactions.FirstOrDefaultAsync(t => t.Id == id);
                if (freshCheckout is null || freshCheckout.Status != PaymentGatewayTransactionStatus.Initiated)
                {
                    // Lost the race to a concurrent callback delivery -- nothing to do, the other
                    // attempt already handled it (or the row vanished, which shouldn't happen).
                    await transaction.RollbackAsync();
                    return;
                }

                freshCheckout.Status = PaymentGatewayTransactionStatus.Success;
                freshCheckout.RawGatewayPayload = request.RawPayload;
                freshCheckout.CompletedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync();

                var creditResult = await creditService.CreditAsync(
                    tenantContext.TenantId,
                    freshCheckout.ParentId,
                    freshCheckout.Amount,
                    $"Payment checkout {freshCheckout.Id} succeeded",
                    null,
                    $"payment-checkout:{freshCheckout.Id}");

                if (!creditResult.Success)
                {
                    // The credit itself failed for a reason other than "already credited" (e.g. an
                    // idempotency mismatch, which should be structurally impossible here since the
                    // key is derived from this transaction's own Id and this is the only place that
                    // ever uses it) -- roll back the status flip too, so the checkout stays
                    // Initiated and the callback can be safely retried/investigated rather than
                    // silently recording Success with no credit.
                    await transaction.RollbackAsync();
                    return;
                }

                await transaction.CommitAsync();
            });

            var finalCheckout = await db.PaymentGatewayTransactions.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
            return Results.Ok(ToResponse(finalCheckout!));
        });
    }

    private static PaymentCheckoutResponse ToResponse(PaymentGatewayTransaction checkout, string? checkoutUrl = null) => new()
    {
        Id = checkout.Id,
        ParentId = checkout.ParentId,
        Amount = checkout.Amount,
        Rail = checkout.Rail,
        Status = checkout.Status,
        MerchantReference = checkout.MerchantReference,
        CheckoutUrl = checkoutUrl,
        CreatedAt = checkout.CreatedAt,
        CompletedAt = checkout.CompletedAt
    };
}
```

Note on `CheckoutUrl`: it is only ever populated on the `POST /payment-checkouts` response (where the freshly-created `GatewayCheckoutSession` is in scope) — `GET` endpoints and the callback response return `null` for it, since `PaymentGatewayTransaction` doesn't persist the checkout URL itself (only the `MerchantReference`, per the data model in the spec). This is intentional: the URL is only useful once, at creation time, to redirect the browser.

- [ ] **Step 6: Wire the endpoints and the stub client into `Program.cs`**

In `services/billing-api/BillingApi/Program.cs`, add this line right after the existing `builder.Services.AddScoped<BillingApi.Services.WalletCreditService>();` line (added in Task 1):

```csharp
builder.Services.AddSingleton<IPaymentGatewayClient, StubPaymentGatewayClient>();
```

(`AddSingleton` because `StubPaymentGatewayClient` is stateless and holds no dependencies — when a real provider is swapped in later, its registration lifetime should be reconsidered based on what that implementation actually needs, e.g. `AddHttpClient<IPaymentGatewayClient, RealProviderClient>(...)` for a real HTTP-backed one.)

Add `using BillingApi.Clients;` to the top of the file.

Add this line right after the existing `app.MapWalletEndpoints();` line:

```csharp
app.MapPaymentCheckoutEndpoints();
```

- [ ] **Step 7: Generate the migration**

```bash
cd services/billing-api/BillingApi
dotnet ef migrations add AddPaymentGatewayTransaction --output-dir Migrations
cd ../../..
```

- [ ] **Step 8: Build and run the manual smoke check**

Run: `dotnet build services/billing-api/BillingApi/BillingApi.csproj`
Expected: 0 errors.

```bash
cd services/billing-api/BillingApi
dotnet run &
sleep 5
curl -s http://localhost:5320/health
kill %1
cd ../../..
```

Expected: `{"status":"Healthy","service":"BillingApi"}`. This confirms the new migration applies cleanly and DI resolves `IPaymentGatewayClient`/`WalletCreditService` correctly at startup.

- [ ] **Step 9: Commit**

```bash
git add services/billing-api/BillingApi/Entities/PaymentGatewayTransaction.cs services/billing-api/BillingApi/Clients services/billing-api/BillingApi/Dtos/PaymentCheckoutDtos.cs services/billing-api/BillingApi/Endpoints/PaymentCheckoutEndpoints.cs services/billing-api/BillingApi/Data/BillingDbContext.cs services/billing-api/BillingApi/Program.cs services/billing-api/BillingApi/Migrations
git commit -m "feat(billing-api): add payment gateway checkout flow with stub client, crediting wallet on success (tests deferred to later pass)"
```

---

## Definition of done for this plan

- [ ] `dotnet build services/billing-api/BillingApi/BillingApi.csproj` succeeds with 0 errors
- [ ] `POST /credit`'s and `POST /debit`'s behavior is verifiably unchanged after Task 1 (reviewer diffs the extracted logic line-for-line against the original)
- [ ] A successful callback credits the wallet exactly once; a redelivered callback to an already-terminal checkout is a safe no-op
- [ ] Both commits from this plan are present in `git log`
- [ ] **Test coverage for this sub-project remains outstanding** — tracked in `DEFERRED-AND-TODO.md`'s 🔴 tier alongside the rest of `BillingApi`
- [ ] Phase 3's last remaining sub-project (Reports) is unblocked
