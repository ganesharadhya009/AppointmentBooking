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
