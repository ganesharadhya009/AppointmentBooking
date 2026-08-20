using SchedulingApi.Common;
using SchedulingApi.Data;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Endpoints;

public static class AppointmentReportEndpoints
{
    public static void MapAppointmentReportEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/appointments/reports");

        group.MapGet("/unified", async (int? page, int? pageSize, DateOnly? dateFrom, DateOnly? dateTo, AppointmentStatus? status, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var therapistQuery = db.Appointments.AsQueryable();
            var doctorQuery = db.DoctorAppointments.AsQueryable();

            if (dateFrom is not null)
            {
                therapistQuery = therapistQuery.Where(a => a.AppointmentDate >= dateFrom.Value);
                doctorQuery = doctorQuery.Where(a => a.AppointmentDate >= dateFrom.Value);
            }
            if (dateTo is not null)
            {
                therapistQuery = therapistQuery.Where(a => a.AppointmentDate <= dateTo.Value);
                doctorQuery = doctorQuery.Where(a => a.AppointmentDate <= dateTo.Value);
            }
            if (status is not null)
            {
                therapistQuery = therapistQuery.Where(a => a.Status == status.Value);
                doctorQuery = doctorQuery.Where(a => a.Status == status.Value);
            }

            // Merged in memory rather than a SQL-level UNION -- acceptable at current scale (see
            // design spec §3); a genuinely large dataset would need a different query shape.
            var therapistItems = await therapistQuery.ToListAsync();
            var doctorItems = await doctorQuery.ToListAsync();

            var merged = therapistItems.Select(ToUnifiedResponse)
                .Concat(doctorItems.Select(ToUnifiedResponse))
                .OrderByDescending(x => x.AppointmentDate)
                .ThenBy(x => x.Id)
                .ToList();

            var totalCount = merged.Count;
            var items = merged.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToList();

            return Results.Ok(new PagedResult<UnifiedAppointmentResponse>
            {
                Items = items,
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/cancellations", async (int? page, int? pageSize, Guid? branchId, bool? groupByChild, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Appointments.Where(a => a.Status == AppointmentStatus.Cancelled);
            if (branchId is not null)
            {
                query = query.Where(a => a.BranchId == branchId.Value);
            }

            if (groupByChild == true)
            {
                var grouped = await query
                    .GroupBy(a => a.ChildId)
                    .Select(g => new ChildCancellationSummary { ChildId = g.Key, CancellationCount = g.Count() })
                    .OrderByDescending(x => x.CancellationCount)
                    .ToListAsync();

                var totalGroupCount = grouped.Count;
                var groupItems = grouped.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToList();

                return Results.Ok(new PagedResult<ChildCancellationSummary>
                {
                    Items = groupItems,
                    Page = currentPage,
                    PageSize = currentPageSize,
                    TotalCount = totalGroupCount
                });
            }

            var ordered = query.OrderByDescending(a => a.AppointmentDate).ThenBy(a => a.Id);
            var totalCount = await ordered.CountAsync();
            var items = await ordered.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<AppointmentResponse>
            {
                Items = items.Select(AppointmentEndpointsResponseAdapter.ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });
    }

    private static UnifiedAppointmentResponse ToUnifiedResponse(Appointment a) => new()
    {
        Id = a.Id,
        Kind = AppointmentKind.Therapist,
        ChildId = a.ChildId,
        AppointmentDate = a.AppointmentDate,
        Amount = a.PricePerSession,
        Status = a.Status,
        BranchId = a.BranchId,
        TherapistId = a.TherapistId,
        TherapyTypeId = a.TherapyTypeId
    };

    private static UnifiedAppointmentResponse ToUnifiedResponse(DoctorAppointment a) => new()
    {
        Id = a.Id,
        Kind = AppointmentKind.Doctor,
        ChildId = a.ChildId,
        AppointmentDate = a.AppointmentDate,
        Amount = a.ConsultationFee,
        Status = a.Status,
        ConsultantDoctorId = a.ConsultantDoctorId,
        ConsultantClinicId = a.ConsultantClinicId
    };
}

internal static class AppointmentEndpointsResponseAdapter
{
    public static AppointmentResponse ToResponse(Appointment appointment) => AppointmentEndpoints.ToResponse(appointment);
}
