using SchedulingApi.Common;
using SchedulingApi.Data;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Tenancy;
using SchedulingApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace SchedulingApi.Endpoints;

public static class RefundRequestEndpoints
{
    public static void MapRefundRequestEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/refund-requests");

        group.MapGet("", async (int? page, int? pageSize, RefundRequestStatus? status, SchedulingDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.RefundRequests.AsQueryable();
            if (status is not null)
            {
                query = query.Where(r => r.Status == status);
            }
            query = query.OrderByDescending(r => r.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<RefundRequestResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapPost("", async (CreateRefundRequestRequest request, SchedulingDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (request.AppointmentType == RefundRequestAppointmentType.TherapistAppointment)
            {
                var appointment = await db.Appointments.FirstOrDefaultAsync(a => a.Id == request.AppointmentId);
                if (appointment is null)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentId"] = ["Appointment not found or does not belong to this tenant."] });
                }
            }
            else
            {
                var doctorAppointment = await db.DoctorAppointments.FirstOrDefaultAsync(a => a.Id == request.AppointmentId);
                if (doctorAppointment is null)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["appointmentId"] = ["Doctor appointment not found or does not belong to this tenant."] });
                }
            }

            var hasActiveRefundRequest = await db.RefundRequests.AnyAsync(r =>
                r.AppointmentType == request.AppointmentType &&
                r.AppointmentId == request.AppointmentId &&
                r.Status != RefundRequestStatus.Rejected);
            if (hasActiveRefundRequest)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Refund request already exists", detail: "This appointment already has a pending or approved refund request.");
            }

            var refundRequest = new RefundRequest
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                AppointmentType = request.AppointmentType!.Value,
                AppointmentId = request.AppointmentId,
                Amount = request.Amount!.Value,
                Status = RefundRequestStatus.Pending,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.RefundRequests.Add(refundRequest);
            await db.SaveChangesAsync();

            return Results.Created($"/refund-requests/{refundRequest.Id}", ToResponse(refundRequest));
        });

        group.MapPost("/{id:guid}/approve", async (Guid id, SchedulingDbContext db) =>
        {
            var refundRequest = await db.RefundRequests.FirstOrDefaultAsync(r => r.Id == id);
            if (refundRequest is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Refund request not found");
            }

            if (refundRequest.Status != RefundRequestStatus.Pending)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Refund request already actioned", detail: "Only a pending refund request can be approved.");
            }

            refundRequest.Status = RefundRequestStatus.Approved;
            refundRequest.ApprovedBy = "system";
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(refundRequest));
        });

        group.MapPost("/{id:guid}/reject", async (Guid id, SchedulingDbContext db) =>
        {
            var refundRequest = await db.RefundRequests.FirstOrDefaultAsync(r => r.Id == id);
            if (refundRequest is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Refund request not found");
            }

            if (refundRequest.Status != RefundRequestStatus.Pending)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Refund request already actioned", detail: "Only a pending refund request can be rejected.");
            }

            refundRequest.Status = RefundRequestStatus.Rejected;
            refundRequest.ApprovedBy = "system";
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(refundRequest));
        });
    }

    private static RefundRequestResponse ToResponse(RefundRequest refundRequest) => new()
    {
        Id = refundRequest.Id,
        AppointmentType = refundRequest.AppointmentType,
        AppointmentId = refundRequest.AppointmentId,
        Amount = refundRequest.Amount,
        Status = refundRequest.Status,
        ApprovedBy = refundRequest.ApprovedBy
    };
}
