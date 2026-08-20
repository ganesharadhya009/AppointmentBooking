using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class LeaveRequestEndpoints
{
    public static void MapLeaveRequestEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/leave-requests");

        group.MapGet("", async (int? page, int? pageSize, Guid? therapistId, LeaveRequestStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.LeaveRequests.AsQueryable();

            if (therapistId is not null)
            {
                query = query.Where(l => l.TherapistId == therapistId);
            }

            if (status is not null)
            {
                query = query.Where(l => l.Status == status);
            }

            query = query.OrderByDescending(l => l.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<LeaveRequestResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/is-on-leave", async (Guid therapistId, DateOnly date, DirectoryDbContext db) =>
        {
            var isOnLeave = await db.LeaveRequests.AnyAsync(l =>
                l.TherapistId == therapistId &&
                l.Status == LeaveRequestStatus.Approved &&
                l.StartDate <= date &&
                l.EndDate >= date);
            return Results.Ok(new IsOnLeaveResponse { IsOnLeave = isOnLeave });
        });

        group.MapGet("/active-count", async (DateOnly date, DirectoryDbContext db) =>
        {
            var activeCount = await db.LeaveRequests.CountAsync(l =>
                l.Status == LeaveRequestStatus.Approved &&
                l.StartDate <= date &&
                l.EndDate >= date);
            return Results.Ok(new ActiveLeaveCountResponse { ActiveCount = activeCount });
        });

        group.MapPost("", async (CreateLeaveRequestRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (request.EndDate!.Value < request.StartDate!.Value)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["endDate"] = ["End date must be on or after the start date."]
                });
            }

            var therapist = await db.Therapists.FirstOrDefaultAsync(t => t.Id == request.TherapistId);
            if (therapist is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["therapistId"] = ["Therapist not found or does not belong to this tenant."]
                });
            }

            var leaveRequest = new LeaveRequest
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                TherapistId = request.TherapistId,
                StartDate = request.StartDate!.Value,
                EndDate = request.EndDate!.Value,
                Status = LeaveRequestStatus.Pending,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.LeaveRequests.Add(leaveRequest);
            await db.SaveChangesAsync();

            return Results.Created($"/leave-requests/{leaveRequest.Id}", ToResponse(leaveRequest));
        });

        group.MapPost("/{id:guid}/approve", async (Guid id, DirectoryDbContext db) =>
        {
            var leaveRequest = await db.LeaveRequests.FirstOrDefaultAsync(l => l.Id == id);
            if (leaveRequest is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Leave request not found");
            }

            if (leaveRequest.Status != LeaveRequestStatus.Pending)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Leave request already actioned", detail: "Only a pending leave request can be approved.");
            }

            leaveRequest.Status = LeaveRequestStatus.Approved;
            leaveRequest.ApprovedBy = "system";
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(leaveRequest));
        });

        group.MapPost("/{id:guid}/reject", async (Guid id, DirectoryDbContext db) =>
        {
            var leaveRequest = await db.LeaveRequests.FirstOrDefaultAsync(l => l.Id == id);
            if (leaveRequest is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Leave request not found");
            }

            if (leaveRequest.Status != LeaveRequestStatus.Pending)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Leave request already actioned", detail: "Only a pending leave request can be rejected.");
            }

            leaveRequest.Status = LeaveRequestStatus.Rejected;
            leaveRequest.ApprovedBy = "system";
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(leaveRequest));
        });
    }

    private static LeaveRequestResponse ToResponse(LeaveRequest leaveRequest) => new()
    {
        Id = leaveRequest.Id,
        TherapistId = leaveRequest.TherapistId,
        StartDate = leaveRequest.StartDate,
        EndDate = leaveRequest.EndDate,
        Status = leaveRequest.Status,
        ApprovedBy = leaveRequest.ApprovedBy
    };
}
