using SchedulingApi.Entities;
using SchedulingApi.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Data;

public class SchedulingDbContext(DbContextOptions<SchedulingDbContext> options, ITenantContext tenantContext)
    : DbContext(options)
{
    public DbSet<Appointment> Appointments => Set<Appointment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Appointment>(a =>
        {
            a.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            a.HasIndex(x => x.TenantId);
            a.HasIndex(x => new { x.TenantId, x.BranchId, x.TherapistId, x.TherapyTypeId, x.AppointmentDate });
            a.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
            a.Property(x => x.PricePerSession).HasColumnType("decimal(10,2)");
            a.Property(x => x.IdempotencyKey).HasMaxLength(200);
            a.Property(x => x.BookedBy).HasMaxLength(200);
        });
    }
}
