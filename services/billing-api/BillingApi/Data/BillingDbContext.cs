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
