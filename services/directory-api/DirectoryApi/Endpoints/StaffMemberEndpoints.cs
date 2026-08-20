using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class StaffMemberEndpoints
{
    public static void MapStaffMemberEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/staff-members");

        group.MapGet("", async (int? page, int? pageSize, StaffRole? role, bool? isActive, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.StaffMembers.AsQueryable();
            if (role is not null)
            {
                query = query.Where(s => s.Role == role.Value);
            }
            if (isActive is not null)
            {
                query = query.Where(s => s.IsActive == isActive.Value);
            }
            var ordered = query.OrderBy(s => s.Name).ThenBy(s => s.Id);

            var totalCount = await ordered.CountAsync();
            var items = await ordered.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<StaffMemberResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var staffMember = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id);
            return staffMember is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Staff member not found")
                : Results.Ok(ToResponse(staffMember));
        });

        group.MapPost("", async (CreateStaffMemberRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var staffMember = new StaffMember
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                Email = request.Email,
                Phone = request.Phone,
                Role = request.Role!.Value,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.StaffMembers.Add(staffMember);
            await db.SaveChangesAsync();

            return Results.Created($"/staff-members/{staffMember.Id}", ToResponse(staffMember));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateStaffMemberRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var staffMember = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id);
            if (staffMember is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Staff member not found");
            }

            staffMember.Name = request.Name;
            staffMember.Email = request.Email;
            staffMember.Phone = request.Phone;
            staffMember.Role = request.Role!.Value;
            staffMember.IsActive = request.IsActive!.Value;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(staffMember));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var staffMember = await db.StaffMembers.FirstOrDefaultAsync(s => s.Id == id);
            if (staffMember is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Staff member not found");
            }

            db.StaffMembers.Remove(staffMember);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static StaffMemberResponse ToResponse(StaffMember staffMember) => new()
    {
        Id = staffMember.Id,
        Name = staffMember.Name,
        Email = staffMember.Email,
        Phone = staffMember.Phone,
        Role = staffMember.Role,
        IsActive = staffMember.IsActive,
        CreatedAt = staffMember.CreatedAt
    };
}
