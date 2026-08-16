using ClientRecordsApi.Entities;
using ClientRecordsApi.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ClientRecordsApi.Data;

public class ClientRecordsDbContext(DbContextOptions<ClientRecordsDbContext> options, ITenantContext tenantContext)
    : DbContext(options)
{
    public DbSet<Parent> Parents => Set<Parent>();
    public DbSet<Child> Children => Set<Child>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Parent>(p =>
        {
            p.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            p.HasIndex(x => x.TenantId);
            p.Property(x => x.Name).HasMaxLength(200);
            p.Property(x => x.MobileNumber).HasMaxLength(20);
            p.Property(x => x.Email).HasMaxLength(200);
            p.Property(x => x.Address).HasMaxLength(500);
            p.Property(x => x.City).HasMaxLength(100);
            p.Property(x => x.State).HasMaxLength(100);
            p.Property(x => x.Country).HasMaxLength(100);
        });

        modelBuilder.Entity<Child>(c =>
        {
            c.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            c.HasIndex(x => x.TenantId);
            c.HasIndex(x => x.ParentId);
            c.Property(x => x.Name).HasMaxLength(200);
            c.Property(x => x.Gender).HasMaxLength(20);
            c.Property(x => x.GuardianName).HasMaxLength(200);
        });
    }
}
