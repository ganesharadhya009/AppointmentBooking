using ClientRecordsApi.Common;
using ClientRecordsApi.Data;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tenancy;
using ClientRecordsApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace ClientRecordsApi.Endpoints;

public static class ChildEndpoints
{
    public static void MapChildEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/children");

        group.MapGet("", async (int? page, int? pageSize, Guid? parentId, ClientRecordsDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var filtered = db.Children.AsQueryable();
            if (parentId is not null)
            {
                filtered = filtered.Where(c => c.ParentId == parentId.Value);
            }

            var query = filtered.OrderBy(c => c.Name);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ChildResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var child = await db.Children.FirstOrDefaultAsync(c => c.Id == id);
            return child is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Child not found")
                : Results.Ok(ToResponse(child));
        });

        group.MapPost("", async (CreateChildRequest request, ClientRecordsDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var parentExists = await db.Parents.AnyAsync(p => p.Id == request.ParentId);
            if (!parentExists)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["parentId"] = ["The parent ID was not found or does not belong to this tenant."]
                });
            }

            var child = new Child
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ParentId = request.ParentId,
                Name = request.Name,
                DateOfBirth = request.DateOfBirth!.Value,
                Gender = request.Gender,
                GuardianName = request.GuardianName,
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            db.Children.Add(child);
            await db.SaveChangesAsync();

            return Results.Created($"/children/{child.Id}", ToResponse(child));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateChildRequest request, ClientRecordsDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var parentExists = await db.Parents.AnyAsync(p => p.Id == request.ParentId);
            if (!parentExists)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["parentId"] = ["The parent ID was not found or does not belong to this tenant."]
                });
            }

            var child = await db.Children.FirstOrDefaultAsync(c => c.Id == id);
            if (child is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Child not found");
            }

            child.ParentId = request.ParentId;
            child.Name = request.Name;
            child.DateOfBirth = request.DateOfBirth!.Value;
            child.Gender = request.Gender;
            child.GuardianName = request.GuardianName;
            child.Status = request.Status!.Value;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(child));
        });

        group.MapDelete("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var child = await db.Children.FirstOrDefaultAsync(c => c.Id == id);
            if (child is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Child not found");
            }

            child.Status = ClientStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ChildResponse ToResponse(Child child) => new()
    {
        Id = child.Id,
        ParentId = child.ParentId,
        Name = child.Name,
        DateOfBirth = child.DateOfBirth,
        Gender = child.Gender,
        GuardianName = child.GuardianName,
        Status = child.Status
    };
}
