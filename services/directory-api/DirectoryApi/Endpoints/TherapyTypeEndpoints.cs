using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class TherapyTypeEndpoints
{
    public static void MapTherapyTypeEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/therapy-types");

        group.MapGet("", async (int? page, int? pageSize, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.TherapyTypes.Include(t => t.Branches).OrderBy(t => t.Name);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<TherapyTypeResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var therapyType = await db.TherapyTypes.Include(t => t.Branches).FirstOrDefaultAsync(t => t.Id == id);
            return therapyType is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapy type not found")
                : Results.Ok(ToResponse(therapyType));
        });

        group.MapPost("", async (CreateTherapyTypeRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var branchIds = request.BranchIds ?? [];
            var branches = await db.Branches.Where(b => branchIds.Contains(b.Id)).ToListAsync();
            if (branches.Count != branchIds.Distinct().Count())
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["branchIds"] = ["One or more branch IDs were not found or do not belong to this tenant."]
                });
            }

            var therapyType = new TherapyType
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                PhotoUrl = request.PhotoUrl,
                Status = TherapyTypeStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system",
                Branches = branches
            };

            db.TherapyTypes.Add(therapyType);
            await db.SaveChangesAsync();

            return Results.Created($"/therapy-types/{therapyType.Id}", ToResponse(therapyType));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateTherapyTypeRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var therapyType = await db.TherapyTypes.Include(t => t.Branches).FirstOrDefaultAsync(t => t.Id == id);
            if (therapyType is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapy type not found");
            }

            if (therapyType.Status == TherapyTypeStatus.Deleted && request.Status != TherapyTypeStatus.Deleted)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["status"] = ["A deleted therapy type cannot be reactivated."]
                });
            }

            var branchIds = request.BranchIds ?? [];
            var branches = await db.Branches.Where(b => branchIds.Contains(b.Id)).ToListAsync();
            if (branches.Count != branchIds.Distinct().Count())
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["branchIds"] = ["One or more branch IDs were not found or do not belong to this tenant."]
                });
            }

            therapyType.Name = request.Name;
            therapyType.PhotoUrl = request.PhotoUrl;
            therapyType.Status = request.Status;
            therapyType.Branches = branches;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(therapyType));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var therapyType = await db.TherapyTypes.FirstOrDefaultAsync(t => t.Id == id);
            if (therapyType is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapy type not found");
            }

            therapyType.Status = TherapyTypeStatus.Deleted;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static TherapyTypeResponse ToResponse(TherapyType therapyType) => new()
    {
        Id = therapyType.Id,
        Name = therapyType.Name,
        PhotoUrl = therapyType.PhotoUrl,
        Status = therapyType.Status,
        BranchIds = therapyType.Branches.Select(b => b.Id).ToList()
    };
}
