using SchedulingApi.Clients;
using SchedulingApi.Data;
using SchedulingApi.Dtos;
using SchedulingApi.Services;
using SchedulingApi.Tenancy;
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
        // GET/POST/PUT/DELETE on this group are added in later tasks.
    }
}
