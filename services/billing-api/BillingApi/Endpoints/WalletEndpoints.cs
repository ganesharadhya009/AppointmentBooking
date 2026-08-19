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
            // ThenByDescending(Id) gives ties on CreatedAt (same tick) a stable, deterministic
            // tiebreaker so paginated results can't skip or duplicate rows across pages.
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

            var amount = request.Amount!.Value;

            var existing = await db.WalletTransactions.AsNoTracking().FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
            if (existing is not null)
            {
                var mismatch = await FindIdempotencyMismatchAsync(db, existing, parentId, WalletTransactionType.Debit, amount);
                return mismatch ?? Results.Ok(ToTransactionResponse(existing));
            }

            var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.ParentId == parentId);
            if (wallet is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Insufficient balance", detail: "This wallet does not have enough balance to cover this debit.");
            }

            IResult? conflict = null;
            WalletTransaction? committed = null;

            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();

                await using var transaction = await db.Database.BeginTransactionAsync();

                // Atomic, single-statement balance update whose WHERE clause carries the
                // sufficiency check in the same statement as the decrement: if another concurrent
                // debit already dropped the balance below what this one needs, or the balance was
                // never enough, this affects 0 rows instead of racing an in-memory read/guard/write.
                var affected = await db.Wallets
                    .Where(w => w.Id == wallet.Id && w.Balance >= amount)
                    .ExecuteUpdateAsync(s => s.SetProperty(w => w.Balance, w => w.Balance - amount));

                if (affected == 0)
                {
                    await transaction.RollbackAsync();
                    conflict = Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Insufficient balance", detail: "This wallet does not have enough balance to cover this debit.");
                    return;
                }

                var newTransaction = BuildTransaction(tenantContext.TenantId, wallet.Id, WalletTransactionType.Debit, amount, request.Reason, request.RelatedAppointmentId, idempotencyKey!);
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
                        var mismatch = await FindIdempotencyMismatchAsync(db, raced, parentId, WalletTransactionType.Debit, amount);
                        conflict = mismatch;
                        committed = mismatch is null ? raced : null;
                        return;
                    }

                    conflict = Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Concurrent debit conflict", detail: "Please retry the request.");
                    return;
                }

                await transaction.CommitAsync();
                committed = newTransaction;
            });

            return conflict ?? Results.Ok(ToTransactionResponse(committed!));
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

    // A replayed idempotency key must be verified against the wallet/type/amount actually being
    // requested before its stored transaction is handed back — otherwise a reused key could return
    // an unrelated stored transaction (e.g. a credit for a different parent) as if it were this
    // request's result. Returns a 409 IResult on mismatch, or null when the stored transaction is a
    // legitimate replay of this exact request.
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
