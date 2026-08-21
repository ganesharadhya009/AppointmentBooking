using System.Text.Json;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ClientRecordsApi.Data;

public class ClientRecordsDbContext(DbContextOptions<ClientRecordsDbContext> options, ITenantContext tenantContext)
    : DbContext(options)
{
    public DbSet<Parent> Parents => Set<Parent>();
    public DbSet<Child> Children => Set<Child>();
    public DbSet<Enquiry> Enquiries => Set<Enquiry>();

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

        var concernsConverter = new ValueConverter<List<string>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>());
        var concernsComparer = new ValueComparer<List<string>>(
            (c1, c2) => (c1 ?? new List<string>()).SequenceEqual(c2 ?? new List<string>()),
            c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
            c => c.ToList());

        modelBuilder.Entity<Enquiry>(e =>
        {
            e.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            e.HasIndex(x => x.TenantId);
            e.Property(x => x.ParentName).HasMaxLength(200);
            e.Property(x => x.ParentMobileNumber).HasMaxLength(20);
            e.Property(x => x.ParentEmail).HasMaxLength(200);
            e.Property(x => x.ChildName).HasMaxLength(200);
            e.Property(x => x.ChildGender).HasMaxLength(20);
            e.Property(x => x.PreferredTherapy).HasMaxLength(200);
            e.Property(x => x.PreferredLocation).HasMaxLength(200);
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.City).HasMaxLength(100);
            e.Property(x => x.State).HasMaxLength(100);
            e.Property(x => x.Country).HasMaxLength(100);
            e.Property(x => x.Concerns)
                .HasConversion(concernsConverter)
                .HasColumnType("text")
                .Metadata.SetValueComparer(concernsComparer);
        });
    }
}
