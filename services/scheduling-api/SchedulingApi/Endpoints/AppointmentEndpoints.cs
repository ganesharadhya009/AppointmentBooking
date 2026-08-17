using SchedulingApi.Clients;
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
            if (therapist is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist not found");
            }

            var assignment = therapist.Assignments.FirstOrDefault(a => a.BranchId == branchId && a.TherapyTypeId == therapyTypeId);
            if (assignment is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist is not assigned to this branch/therapy type");
            }

            var existingAppointments = await db.Appointments
                .Where(a => a.BranchId == branchId && a.TherapistId == therapistId && a.TherapyTypeId == therapyTypeId && a.AppointmentDate == date)
                .ToListAsync();

            var availableWindows = AvailabilityCalculator.ComputeAvailableWindows(assignment, existingAppointments);

            return Results.Ok(new AvailabilityResponse { AvailableWindows = availableWindows });
        });

        var group = app.MapGroup("/appointments");

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
            await db.SaveChangesAsync();

            return Results.Created($"/appointments/{appointment.Id}", ToResponse(appointment));
        });
    }

    private static AppointmentResponse ToResponse(Appointment appointment) => new()
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
