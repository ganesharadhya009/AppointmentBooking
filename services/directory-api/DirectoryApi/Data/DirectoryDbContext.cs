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
    public DbSet<Therapist> Therapists => Set<Therapist>();
    public DbSet<TherapistAssignment> TherapistAssignments => Set<TherapistAssignment>();
    public DbSet<TherapistSessionWindow> TherapistSessionWindows => Set<TherapistSessionWindow>();
    public DbSet<Holiday> Holidays => Set<Holiday>();
    public DbSet<ConsultantService> ConsultantServices => Set<ConsultantService>();
    public DbSet<ConsultantClinic> ConsultantClinics => Set<ConsultantClinic>();
    public DbSet<ConsultantDoctor> ConsultantDoctors => Set<ConsultantDoctor>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(t =>
        {
            t.Property(x => x.Name).HasMaxLength(200);
        });

        modelBuilder.Entity<Branch>(b =>
        {
            b.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            b.Property(x => x.Name).HasMaxLength(200);
            b.Property(x => x.Address).HasMaxLength(500);
            b.Property(x => x.Country).HasMaxLength(100);
            b.Property(x => x.State).HasMaxLength(100);
            b.Property(x => x.City).HasMaxLength(100);
            b.HasIndex(x => x.TenantId);
            b.HasMany(x => x.DiscountTiers)
                .WithOne()
                .HasForeignKey(t => t.BranchId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BranchDiscountTier>(t =>
        {
            t.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            t.HasIndex(x => new { x.BranchId, x.SessionCount }).IsUnique();
            t.HasIndex(x => x.TenantId);
            t.Property(x => x.DiscountPerSession).HasColumnType("decimal(10,2)");
        });

        modelBuilder.Entity<TherapyType>(t =>
        {
            t.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            t.Property(x => x.Name).HasMaxLength(200);
            t.HasIndex(x => x.TenantId);
            t.HasMany(x => x.Branches)
                .WithMany(x => x.TherapyTypes)
                .UsingEntity(j => j.ToTable("TherapyTypeBranch"));
        });

        modelBuilder.Entity<Therapist>(t =>
        {
            t.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            t.Property(x => x.Name).HasMaxLength(200);
            t.Property(x => x.MobileNumber).HasMaxLength(20);
            t.Property(x => x.Email).HasMaxLength(200);
            t.Property(x => x.LicenseNumber).HasMaxLength(100);
            t.Property(x => x.Gender).HasMaxLength(20);
            t.Property(x => x.Designation).HasMaxLength(200);
            t.HasIndex(x => x.TenantId);
            t.HasMany(x => x.Assignments)
                .WithOne()
                .HasForeignKey(a => a.TherapistId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TherapistAssignment>(a =>
        {
            a.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            a.HasIndex(x => x.TenantId);
            a.HasMany(x => x.SessionWindows)
                .WithOne()
                .HasForeignKey(w => w.AssignmentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TherapistSessionWindow>(w =>
        {
            w.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            w.HasIndex(x => x.TenantId);
            w.Property(x => x.PricePerSession).HasColumnType("decimal(10,2)");
        });

        modelBuilder.Entity<Holiday>(h =>
        {
            h.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            h.HasIndex(x => x.TenantId);
            h.HasIndex(x => new { x.TenantId, x.BranchId, x.Date }).IsUnique();
            h.Property(x => x.Reason).HasMaxLength(500);
        });

        modelBuilder.Entity<ConsultantService>(s =>
        {
            s.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            s.HasIndex(x => x.TenantId);
            s.Property(x => x.Name).HasMaxLength(200);
        });

        modelBuilder.Entity<ConsultantClinic>(c =>
        {
            c.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            c.HasIndex(x => x.TenantId);
            c.Property(x => x.Name).HasMaxLength(200);
            c.Property(x => x.Address).HasMaxLength(500);
            c.Property(x => x.City).HasMaxLength(100);
            c.Property(x => x.State).HasMaxLength(100);
            c.Property(x => x.Country).HasMaxLength(100);
            c.Property(x => x.LeadContactName).HasMaxLength(200);
            c.Property(x => x.LeadContactPhone).HasMaxLength(20);
        });

        modelBuilder.Entity<ConsultantDoctor>(d =>
        {
            d.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            d.HasIndex(x => x.TenantId);
            d.HasIndex(x => x.ConsultantServiceId);
            d.HasIndex(x => x.ConsultantClinicId);
            d.Property(x => x.Name).HasMaxLength(200);
            d.Property(x => x.ConsultationFee).HasColumnType("decimal(10,2)");
        });
    }
}
