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
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<SupportTicketMessage> SupportTicketMessages => Set<SupportTicketMessage>();
    public DbSet<Banner> Banners => Set<Banner>();
    public DbSet<Poster> Posters => Set<Poster>();
    public DbSet<AppVersion> AppVersions => Set<AppVersion>();
    public DbSet<TenantSubscription> TenantSubscriptions => Set<TenantSubscription>();
    public DbSet<StaffMember> StaffMembers => Set<StaffMember>();

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

        modelBuilder.Entity<LeaveRequest>(l =>
        {
            l.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            l.HasIndex(x => x.TenantId);
            l.HasIndex(x => x.TherapistId);
        });

        modelBuilder.Entity<SupportTicket>(s =>
        {
            s.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            s.HasIndex(x => x.TenantId);
            s.Property(x => x.Category).HasMaxLength(200);
            s.Property(x => x.Title).HasMaxLength(200);
            s.HasMany(x => x.Messages)
                .WithOne()
                .HasForeignKey(m => m.SupportTicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SupportTicketMessage>(m =>
        {
            m.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            m.HasIndex(x => x.TenantId);
            m.Property(x => x.SenderType).HasMaxLength(50);
        });

        modelBuilder.Entity<Banner>(b =>
        {
            b.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            b.HasIndex(x => x.TenantId);
            b.Property(x => x.ImageUrl).HasMaxLength(2000);
            b.Property(x => x.WatermarkTitle).HasMaxLength(200);
        });

        modelBuilder.Entity<Poster>(p =>
        {
            p.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            p.HasIndex(x => x.TenantId);
            p.Property(x => x.Type).HasMaxLength(100);
        });

        modelBuilder.Entity<AppVersion>(a =>
        {
            a.Property(x => x.VersionNumber).HasMaxLength(50);
        });

        modelBuilder.Entity<TenantSubscription>(s =>
        {
            // Tenant-scoped by TenantId like everything else, but NOT via the usual
            // HasQueryFilter(x => x.TenantId == tenantContext.TenantId) pattern -- a caller
            // provisioning/managing a tenant's subscription is, by definition, acting on that
            // exact tenant, so the standard "current caller's own tenant" filter is what every
            // endpoint here already enforces implicitly via TenantId matching the request's
            // resolved tenant. HasIndex + a uniqueness constraint (one subscription per tenant)
            // is what actually matters here.
            s.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            s.HasIndex(x => x.TenantId).IsUnique();
            s.Property(x => x.PlanName).HasMaxLength(100);
        });

        modelBuilder.Entity<StaffMember>(s =>
        {
            s.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            s.HasIndex(x => x.TenantId);
            s.Property(x => x.Name).HasMaxLength(200);
            s.Property(x => x.Email).HasMaxLength(320);
            s.Property(x => x.Phone).HasMaxLength(50);
        });
    }
}
