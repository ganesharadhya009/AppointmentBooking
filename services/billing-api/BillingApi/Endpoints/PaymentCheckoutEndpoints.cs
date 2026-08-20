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

            // Success path. NOTE: this deliberately does NOT wrap WalletCreditService.CreditAsync in
            // an outer db.Database.BeginTransactionAsync() the way the brief originally sketched it
            // (mark Success, then credit, both inside one transaction) -- CreditAsync opens its own
            // transaction internally (see Services/WalletCreditService.cs, reused verbatim from Task
            // 1), and EF Core's RelationalConnection throws InvalidOperationException
            // ("The connection is already in a transaction") if a second BeginTransactionAsync is
            // issued on the same DbContext/connection while one is still open. Verified locally: the
            // originally-sketched nesting throws 500 on every real Success callback, which fails the
            // "successful callback credits the wallet exactly once" requirement outright -- so this
            // credits first, then flips status, instead:
            //   1. Call CreditAsync (idempotent via the `payment-checkout:{id}` key derived from this
            //      row's own Id -- redelivery or a concurrent callback race both land on the same
            //      key, so at most one credit is ever recorded no matter how this is retried).
            //   2. Only if the credit succeeded, flip Status Initiated -> Success with a single
            //      conditional ExecuteUpdateAsync (WHERE Status = Initiated), so a concurrent
            //      redelivery that already flipped it loses the race harmlessly instead of double
            //      writing.
            // If step 2 is never reached (process crash, etc.), the checkout is left Initiated with
            // the wallet already credited; a redelivered callback re-enters here, CreditAsync's
            // idempotency key finds the existing ledger row and returns Success without crediting
            // again, and the status flip then completes -- so this is self-healing on retry rather
            // than losing the credit or double-crediting.
            var creditResult = await creditService.CreditAsync(
                tenantContext.TenantId,
                checkout.ParentId,
                checkout.Amount,
                $"Payment checkout {checkout.Id} succeeded",
                null,
                $"payment-checkout:{checkout.Id}");

            if (!creditResult.Success)
            {
                // The credit itself failed for a reason other than "already credited" (e.g. an
                // idempotency mismatch, which should be structurally impossible here since the key is
                // derived from this transaction's own Id and this is the only place that ever uses
                // it). Leave the checkout Initiated -- nothing was flipped yet -- so the callback can
                // be safely retried/investigated rather than silently recording Success with no
                // credit.
                return creditResult.Error!;
            }

            await db.PaymentGatewayTransactions
                .Where(t => t.Id == id && t.Status == PaymentGatewayTransactionStatus.Initiated)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.Status, PaymentGatewayTransactionStatus.Success)
                    .SetProperty(t => t.RawGatewayPayload, request.RawPayload)
                    .SetProperty(t => t.CompletedAt, DateTimeOffset.UtcNow));

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
