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
