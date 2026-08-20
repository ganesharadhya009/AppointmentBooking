using SchedulingApi.Clients;
using SchedulingApi.Common;
using SchedulingApi.Data;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Tenancy;
using SchedulingApi.Validation;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Endpoints;

public static class DoctorAppointmentEndpoints
{
    public static void MapDoctorAppointmentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/doctor-appointments");

        group.MapGet("", async (int? page, int? pageSize, DateOnly? dateFrom, DateOnly? dateTo, AppointmentStatus? status, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var filtered = db.DoctorAppointments.AsQueryable();
            if (dateFrom is not null)
            {
                filtered = filtered.Where(a => a.AppointmentDate >= dateFrom.Value);
            }
            if (dateTo is not null)
            {
                filtered = filtered.Where(a => a.AppointmentDate <= dateTo.Value);
            }
            if (status is not null)
            {
                filtered = filtered.Where(a => a.Status == status.Value);
            }

            var query = filtered.OrderByDescending(a => a.AppointmentDate).ThenByDescending(a => a.CreatedAt).ThenBy(a => a.Id);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<DoctorAppointmentResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, SchedulingDbContext db) =>
        {
            var appointment = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.Id == id);
            return appointment is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Doctor appointment not found")
                : Results.Ok(ToResponse(appointment));
        });

        group.MapPost("", async (CreateDoctorAppointmentRequest request, HttpRequest httpRequest, SchedulingDbContext db, IDirectoryApiClient directoryClient, IClientRecordsApiClient clientRecordsClient, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (!httpRequest.Headers.TryGetValue("Idempotency-Key", out var idempotencyKeyValues) || string.IsNullOrWhiteSpace(idempotencyKeyValues.ToString()))
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Missing Idempotency-Key header", detail: "POST /doctor-appointments requires an Idempotency-Key header.");
            }
            var idempotencyKey = idempotencyKeyValues.ToString();
            if (idempotencyKey!.Length > 200)
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Idempotency-Key header is too long", detail: "Idempotency-Key must be 200 characters or fewer.");
            }

            var existing = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.IdempotencyKey == idempotencyKey);
            if (existing is not null)
            {
                return Results.Created($"/doctor-appointments/{existing.Id}", ToResponse(existing));
            }

            var doctor = await directoryClient.GetConsultantDoctorAsync(request.ConsultantDoctorId, tenantContext.TenantId);
            if (doctor is null || doctor.Status != RemoteConsultantStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["consultantDoctorId"] = ["Consultant doctor not found or not active."] });
            }

            var child = await clientRecordsClient.GetChildAsync(request.ChildId, tenantContext.TenantId);
            if (child is null || child.Status != RemoteClientStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["childId"] = ["Child not found or not active."] });
            }

            var conflict = await db.DoctorAppointments.AnyAsync(a =>
                a.ConsultantDoctorId == request.ConsultantDoctorId &&
                a.AppointmentDate == request.AppointmentDate!.Value &&
                a.AppointmentTime == request.AppointmentTime!.Value &&
                a.Status != AppointmentStatus.Cancelled);
            if (conflict)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This doctor already has an appointment at this date and time.");
            }

            var appointment = new DoctorAppointment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ConsultantDoctorId = request.ConsultantDoctorId,
                ConsultantClinicId = doctor.ConsultantClinicId,
                ConsultantServiceId = doctor.ConsultantServiceId,
                ChildId = request.ChildId,
                AppointmentDate = request.AppointmentDate!.Value,
                AppointmentTime = request.AppointmentTime!.Value,
                ConsultationFee = doctor.ConsultationFee,
                Status = AppointmentStatus.Planned,
                IdempotencyKey = idempotencyKey!,
                BookedBy = "system",
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.DoctorAppointments.Add(appointment);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                db.ChangeTracker.Clear();
                var raced = await db.DoctorAppointments.AsNoTracking().FirstOrDefaultAsync(a => a.IdempotencyKey == idempotencyKey);
                if (raced is not null)
                {
                    return Results.Created($"/doctor-appointments/{raced.Id}", ToResponse(raced));
                }
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This doctor already has an appointment at this date and time.");
            }

            return Results.Created($"/doctor-appointments/{appointment.Id}", ToResponse(appointment));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateDoctorAppointmentRequest request, SchedulingDbContext db, IDirectoryApiClient directoryClient, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var appointment = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Doctor appointment not found");
            }

            if (appointment.Status == AppointmentStatus.Cancelled)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Appointment is cancelled", detail: "A cancelled appointment cannot be rescheduled.");
            }

            if (appointment.Status == AppointmentStatus.Completed)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Appointment is completed", detail: "A completed appointment cannot be rescheduled.");
            }

            var doctor = await directoryClient.GetConsultantDoctorAsync(appointment.ConsultantDoctorId, tenantContext.TenantId);
            if (doctor is null || doctor.Status != RemoteConsultantStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["consultantDoctorId"] = ["Consultant doctor not found or not active."] });
            }

            var conflict = await db.DoctorAppointments.AnyAsync(a =>
                a.Id != id &&
                a.ConsultantDoctorId == appointment.ConsultantDoctorId &&
                a.AppointmentDate == request.AppointmentDate!.Value &&
                a.AppointmentTime == request.AppointmentTime!.Value &&
                a.Status != AppointmentStatus.Cancelled);
            if (conflict)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This doctor already has an appointment at this date and time.");
            }

            appointment.AppointmentDate = request.AppointmentDate!.Value;
            appointment.AppointmentTime = request.AppointmentTime!.Value;
            appointment.ConsultationFee = doctor.ConsultationFee;

            try
            {
                await db.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This doctor already has an appointment at this date and time.");
            }
            return Results.Ok(ToResponse(appointment));
        });

        group.MapDelete("/{id:guid}", async (Guid id, SchedulingDbContext db) =>
        {
            var appointment = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Doctor appointment not found");
            }

            appointment.Status = AppointmentStatus.Cancelled;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static bool IsUniqueViolation(Microsoft.EntityFrameworkCore.DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };

    private static DoctorAppointmentResponse ToResponse(DoctorAppointment appointment) => new()
    {
        Id = appointment.Id,
        ConsultantDoctorId = appointment.ConsultantDoctorId,
        ConsultantClinicId = appointment.ConsultantClinicId,
        ConsultantServiceId = appointment.ConsultantServiceId,
        ChildId = appointment.ChildId,
        AppointmentDate = appointment.AppointmentDate,
        AppointmentTime = appointment.AppointmentTime,
        ConsultationFee = appointment.ConsultationFee,
        Status = appointment.Status
    };
}
