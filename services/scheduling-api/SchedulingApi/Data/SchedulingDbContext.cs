using SchedulingApi.Entities;
using SchedulingApi.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Data;

public class SchedulingDbContext(DbContextOptions<SchedulingDbContext> options, ITenantContext tenantContext)
    : DbContext(options)
{
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<DoctorAppointment> DoctorAppointments => Set<DoctorAppointment>();
    public DbSet<RefundRequest> RefundRequests => Set<RefundRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Appointment>(a =>
        {
            a.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            a.HasIndex(x => x.TenantId);
            a.HasIndex(x => new { x.TenantId, x.BranchId, x.TherapistId, x.TherapyTypeId, x.AppointmentDate });
            a.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
            a.HasIndex(x => new { x.TenantId, x.BranchId, x.TherapistId, x.TherapyTypeId, x.AppointmentDate, x.WindowName }).IsUnique().HasFilter("[Status] <> 2");
            a.Property(x => x.PricePerSession).HasColumnType("decimal(10,2)");
            a.Property(x => x.IdempotencyKey).HasMaxLength(200);
            a.Property(x => x.BookedBy).HasMaxLength(200);
        });

        modelBuilder.Entity<DoctorAppointment>(d =>
        {
            d.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            d.HasIndex(x => x.TenantId);
            d.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
            d.HasIndex(x => new { x.TenantId, x.ConsultantDoctorId, x.AppointmentDate, x.AppointmentTime }).IsUnique().HasFilter("[Status] <> 2");
            d.Property(x => x.ConsultationFee).HasColumnType("decimal(10,2)");
            d.Property(x => x.IdempotencyKey).HasMaxLength(200);
            d.Property(x => x.BookedBy).HasMaxLength(200);
        });

        modelBuilder.Entity<RefundRequest>(r =>
        {
            r.HasQueryFilter(x => x.TenantId == tenantContext.TenantId);
            r.HasIndex(x => x.TenantId);
            r.Property(x => x.Amount).HasColumnType("decimal(10,2)");
            r.Property(x => x.ApprovedBy).HasMaxLength(200);
        });
    }
}
