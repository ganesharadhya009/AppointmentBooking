using SchedulingApi.Clients;
using SchedulingApi.Common;
using SchedulingApi.Data;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Services;
using SchedulingApi.Tenancy;
using SchedulingApi.Validation;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Endpoints;

public static class AppointmentEndpoints
{
    public static void MapAppointmentEndpoints(this WebApplication app)
    {
        app.MapGet("/availability", async (Guid branchId, Guid therapistId, Guid therapyTypeId, DateOnly date, SchedulingDbContext db, IDirectoryApiClient directoryClient, ITenantContext tenantContext) =>
        {
            var therapist = await directoryClient.GetTherapistAsync(therapistId, tenantContext.TenantId);
            if (therapist is null || therapist.Status != RemoteStatus.Active)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist not found");
            }

            var assignment = therapist.Assignments.FirstOrDefault(a => a.BranchId == branchId && a.TherapyTypeId == therapyTypeId);
            if (assignment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist is not assigned to this branch/therapy type");
            }

            var isClosed = await directoryClient.IsBranchClosedAsync(branchId, date, tenantContext.TenantId);
            if (isClosed == true)
            {
                return Results.Ok(new AvailabilityResponse { AvailableWindows = [] });
            }

            var isOnLeave = await directoryClient.IsTherapistOnLeaveAsync(therapistId, date, tenantContext.TenantId);
            if (isOnLeave == true)
            {
                return Results.Ok(new AvailabilityResponse { AvailableWindows = [] });
            }

            var existingAppointments = await db.Appointments
                .Where(a => a.BranchId == branchId && a.TherapistId == therapistId && a.TherapyTypeId == therapyTypeId && a.AppointmentDate == date)
                .ToListAsync();

            var availableWindows = AvailabilityCalculator.ComputeAvailableWindows(assignment, existingAppointments);

            return Results.Ok(new AvailabilityResponse { AvailableWindows = availableWindows });
        });

        var group = app.MapGroup("/appointments");

        group.MapGet("", async (int? page, int? pageSize, DateOnly? dateFrom, DateOnly? dateTo, Guid? branchId, AppointmentStatus? status, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var filtered = db.Appointments.AsQueryable();
            if (dateFrom is not null)
            {
                filtered = filtered.Where(a => a.AppointmentDate >= dateFrom.Value);
            }
            if (dateTo is not null)
            {
                filtered = filtered.Where(a => a.AppointmentDate <= dateTo.Value);
            }
            if (branchId is not null)
            {
                filtered = filtered.Where(a => a.BranchId == branchId.Value);
            }
            if (status is not null)
            {
                filtered = filtered.Where(a => a.Status == status.Value);
            }

            var query = filtered.OrderByDescending(a => a.AppointmentDate).ThenByDescending(a => a.CreatedAt).ThenBy(a => a.Id);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<AppointmentResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, SchedulingDbContext db) =>
        {
            var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
            return appointment is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Appointment not found")
                : Results.Ok(ToResponse(appointment));
        });

        group.MapPost("", async (CreateAppointmentRequest request, HttpRequest httpRequest, SchedulingDbContext db, IDirectoryApiClient directoryClient, IClientRecordsApiClient clientRecordsClient, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (!httpRequest.Headers.TryGetValue("Idempotency-Key", out var idempotencyKeyValues) || string.IsNullOrWhiteSpace(idempotencyKeyValues.ToString()))
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Missing Idempotency-Key header", detail: "POST /appointments requires an Idempotency-Key header.");
            }
            var idempotencyKey = idempotencyKeyValues.ToString();
            if (idempotencyKey!.Length > 200)
            {
                return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Idempotency-Key header is too long", detail: "Idempotency-Key must be 200 characters or fewer.");
            }

            var existing = await db.Appointments.FirstOrDefaultAsync(a => a.IdempotencyKey == idempotencyKey);
            if (existing is not null)
            {
                return Results.Created($"/appointments/{existing.Id}", ToResponse(existing));
            }

            var branch = await directoryClient.GetBranchAsync(request.BranchId, tenantContext.TenantId);
            if (branch is null || !branch.IsActive)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["branchId"] = ["Branch not found or not active."] });
            }

            var isClosed = await directoryClient.IsBranchClosedAsync(request.BranchId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isClosed == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The branch is closed on this date."] });
            }

            var isOnLeave = await directoryClient.IsTherapistOnLeaveAsync(request.TherapistId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isOnLeave == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The therapist is on approved leave on this date."] });
            }

            var therapist = await directoryClient.GetTherapistAsync(request.TherapistId, tenantContext.TenantId);
            if (therapist is null || therapist.Status != RemoteStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["therapistId"] = ["Therapist not found or not active."] });
            }

            var assignment = therapist.Assignments.FirstOrDefault(a => a.BranchId == request.BranchId && a.TherapyTypeId == request.TherapyTypeId);
            if (assignment is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["therapyTypeId"] = ["Therapist is not assigned to this branch/therapy type."] });
            }

            var clientWindowName = (SchedulingApi.Clients.SessionWindowName)(int)request.WindowName!.Value;
            var sessionWindow = assignment.SessionWindows.FirstOrDefault(w => w.WindowName == clientWindowName);
            if (sessionWindow is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["windowName"] = ["This therapist does not have that session window for this branch/therapy type."] });
            }

            var child = await clientRecordsClient.GetChildAsync(request.ChildId, tenantContext.TenantId);
            if (child is null || child.Status != RemoteClientStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["childId"] = ["Child not found or not active."] });
            }

            var conflict = await db.Appointments.AnyAsync(a =>
                a.BranchId == request.BranchId &&
                a.TherapistId == request.TherapistId &&
                a.TherapyTypeId == request.TherapyTypeId &&
                a.WindowName == request.WindowName!.Value &&
                a.AppointmentDate == request.AppointmentDate!.Value &&
                a.Status != AppointmentStatus.Cancelled);
            if (conflict)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This session window is already booked for the requested date.");
            }

            var appointment = new Appointment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                BranchId = request.BranchId,
                TherapistId = request.TherapistId,
                TherapyTypeId = request.TherapyTypeId,
                ChildId = request.ChildId,
                WindowName = request.WindowName!.Value,
                AppointmentDate = request.AppointmentDate!.Value,
                StartTime = sessionWindow.StartTime,
                EndTime = sessionWindow.EndTime,
                PricePerSession = sessionWindow.PricePerSession,
                Status = AppointmentStatus.Planned,
                IdempotencyKey = idempotencyKey!,
                BookedBy = "system",
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.Appointments.Add(appointment);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                db.ChangeTracker.Clear();
                var raced = await db.Appointments.AsNoTracking().FirstOrDefaultAsync(a => a.IdempotencyKey == idempotencyKey);
                if (raced is not null)
                {
                    return Results.Created($"/appointments/{raced.Id}", ToResponse(raced));
                }
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This session window is already booked for the requested date.");
            }

            return Results.Created($"/appointments/{appointment.Id}", ToResponse(appointment));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateAppointmentRequest request, SchedulingDbContext db, IDirectoryApiClient directoryClient, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Appointment not found");
            }

            if (appointment.Status == AppointmentStatus.Cancelled)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Appointment is cancelled", detail: "A cancelled appointment cannot be rescheduled.");
            }

            if (appointment.Status == AppointmentStatus.Completed)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Appointment is completed", detail: "A completed appointment cannot be rescheduled.");
            }

            var isClosed = await directoryClient.IsBranchClosedAsync(appointment.BranchId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isClosed == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The branch is closed on this date."] });
            }

            var isOnLeave = await directoryClient.IsTherapistOnLeaveAsync(appointment.TherapistId, request.AppointmentDate!.Value, tenantContext.TenantId);
            if (isOnLeave == true)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentDate"] = ["The therapist is on approved leave on this date."] });
            }

            var therapist = await directoryClient.GetTherapistAsync(appointment.TherapistId, tenantContext.TenantId);
            if (therapist is null || therapist.Status != RemoteStatus.Active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["therapistId"] = ["Therapist not found or not active."] });
            }

            var assignment = therapist.Assignments.FirstOrDefault(a => a.BranchId == appointment.BranchId && a.TherapyTypeId == appointment.TherapyTypeId);
            var clientWindowName = (SchedulingApi.Clients.SessionWindowName)(int)request.WindowName!.Value;
            var sessionWindow = assignment?.SessionWindows.FirstOrDefault(w => w.WindowName == clientWindowName);
            if (sessionWindow is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["windowName"] = ["This therapist does not have that session window for this branch/therapy type."] });
            }

            var conflict = await db.Appointments.AnyAsync(a =>
                a.Id != id &&
                a.BranchId == appointment.BranchId &&
                a.TherapistId == appointment.TherapistId &&
                a.TherapyTypeId == appointment.TherapyTypeId &&
                a.WindowName == request.WindowName!.Value &&
                a.AppointmentDate == request.AppointmentDate!.Value &&
                a.Status != AppointmentStatus.Cancelled);
            if (conflict)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This session window is already booked for the requested date.");
            }

            appointment.WindowName = request.WindowName!.Value;
            appointment.AppointmentDate = request.AppointmentDate!.Value;
            appointment.StartTime = sessionWindow.StartTime;
            appointment.EndTime = sessionWindow.EndTime;
            appointment.PricePerSession = sessionWindow.PricePerSession;

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Slot already booked", detail: "This session window is already booked for the requested date.");
            }
            return Results.Ok(ToResponse(appointment));
        });

        group.MapDelete("/{id:guid}", async (Guid id, SchedulingDbContext db) =>
        {
            var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == id);
            if (appointment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Appointment not found");
            }

            appointment.Status = AppointmentStatus.Cancelled;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 };

    internal static AppointmentResponse ToResponse(Appointment appointment) => new()
    {
        Id = appointment.Id,
        BranchId = appointment.BranchId,
        TherapistId = appointment.TherapistId,
        TherapyTypeId = appointment.TherapyTypeId,
        ChildId = appointment.ChildId,
        WindowName = appointment.WindowName,
        AppointmentDate = appointment.AppointmentDate,
        StartTime = appointment.StartTime,
        EndTime = appointment.EndTime,
        PricePerSession = appointment.PricePerSession,
        Status = appointment.Status
    };
}
