using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class BranchEndpoints
{
    public static void MapBranchEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/branches");

        group.MapGet("", async (int? page, int? pageSize, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Branches.Include(b => b.DiscountTiers).OrderBy(b => b.Name);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<BranchResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var branch = await db.Branches.Include(b => b.DiscountTiers).FirstOrDefaultAsync(b => b.Id == id);
            return branch is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Branch not found")
                : Results.Ok(ToResponse(branch));
        });

        group.MapPost("", async (CreateBranchRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            if (!DiscountTierValidator.IsValid(request.DiscountTiers, out var error))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["discountTiers"] = [error!] });
            }

            var branch = new Branch
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                Address = request.Address,
                Country = request.Country,
                State = request.State,
                City = request.City,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                WeeklyDayOff = request.WeeklyDayOff,
                PhotoUrl = request.PhotoUrl,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system",
                DiscountTiers = request.DiscountTiers.Select(t => new BranchDiscountTier
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantContext.TenantId,
                    SessionCount = t.SessionCount,
                    DiscountPerSession = t.DiscountPerSession
                }).ToList()
            };

            db.Branches.Add(branch);
            await db.SaveChangesAsync();

            return Results.Created($"/branches/{branch.Id}", ToResponse(branch));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateBranchRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            if (!DiscountTierValidator.IsValid(request.DiscountTiers, out var error))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["discountTiers"] = [error!] });
            }

            var branch = await db.Branches.Include(b => b.DiscountTiers).FirstOrDefaultAsync(b => b.Id == id);
            if (branch is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Branch not found");
            }

            branch.Name = request.Name;
            branch.Address = request.Address;
            branch.Country = request.Country;
            branch.State = request.State;
            branch.City = request.City;
            branch.Latitude = request.Latitude;
            branch.Longitude = request.Longitude;
            branch.WeeklyDayOff = request.WeeklyDayOff;
            branch.PhotoUrl = request.PhotoUrl;
            branch.IsActive = request.IsActive;

            branch.DiscountTiers.Clear();
            foreach (var tier in request.DiscountTiers)
            {
                branch.DiscountTiers.Add(new BranchDiscountTier
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantContext.TenantId,
                    SessionCount = tier.SessionCount,
                    DiscountPerSession = tier.DiscountPerSession
                });
            }

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(branch));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == id);
            if (branch is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Branch not found");
            }

            var hasTherapyTypes = await db.TherapyTypes.AnyAsync(t => t.Branches.Any(b => b.Id == id));
            if (hasTherapyTypes)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Cannot delete branch",
                    detail: "This branch still has therapy types assigned to it.");
            }

            db.Branches.Remove(branch);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static BranchResponse ToResponse(Branch branch) => new()
    {
        Id = branch.Id,
        Name = branch.Name,
        Address = branch.Address,
        Country = branch.Country,
        State = branch.State,
        City = branch.City,
        Latitude = branch.Latitude,
        Longitude = branch.Longitude,
        WeeklyDayOff = branch.WeeklyDayOff,
        PhotoUrl = branch.PhotoUrl,
        IsActive = branch.IsActive,
        DiscountTiers = branch.DiscountTiers.Select(t => new DiscountTierDto
        {
            SessionCount = t.SessionCount,
            DiscountPerSession = t.DiscountPerSession
        }).ToList()
    };
}
