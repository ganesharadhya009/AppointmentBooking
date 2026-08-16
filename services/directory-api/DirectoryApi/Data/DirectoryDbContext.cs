using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Data;

public class DirectoryDbContext(DbContextOptions<DirectoryDbContext> options, ITenantContext tenantContext)
    : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<BranchDiscountTier> BranchDiscountTiers => Set<BranchDiscountTier>();
    public DbSet<TherapyType> TherapyTypes => Set<TherapyType>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Branch>(b =>
        {
            b.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            b.HasMany(x => x.DiscountTiers)
                .WithOne()
                .HasForeignKey(t => t.BranchId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BranchDiscountTier>(t =>
        {
            t.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            t.HasIndex(x => new { x.BranchId, x.SessionCount }).IsUnique();
            t.Property(x => x.DiscountPerSession).HasColumnType("decimal(10,2)");
        });

        modelBuilder.Entity<TherapyType>(t =>
        {
            t.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            t.HasMany(x => x.Branches)
                .WithMany(x => x.TherapyTypes)
                .UsingEntity(j => j.ToTable("TherapyTypeBranch"));
        });
    }
}
