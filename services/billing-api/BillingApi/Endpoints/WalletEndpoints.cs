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
