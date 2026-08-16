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
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

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
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (!DiscountTierValidator.IsValid(request.DiscountTiers, out var error))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["discountTiers"] = [error!] });
            }

            // A lightweight existence check only (no tracked entity) — the actual entity used for
            // the update is loaded fresh inside the execution-strategy delegate below, so that a
            // retried attempt after a transient fault re-queries committed state instead of reusing
            // a possibly-stale, never-actually-committed in-memory instance from the failed attempt.
            var branchExists = await db.Branches.AnyAsync(b => b.Id == id);
            if (!branchExists)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Branch not found");
            }

            // Deleting old tiers and inserting new ones in the same SaveChangesAsync call can
            // violate the unique (BranchId, SessionCount) index if EF orders the INSERT before
            // the DELETE (there's no FK between the old and new rows to force ordering) — since
            // a branch's tiers always reuse the same fixed session counts, this collision is not
            // hypothetical, it happens on every update. Deleting and saving first avoids it.
            // Both SaveChangesAsync calls are wrapped in one transaction so a failure after the
            // delete (before the new tiers are inserted) can't leave the branch with zero tiers.
            // The transaction runs through the DbContext's execution strategy (rather than a bare
            // BeginTransactionAsync) because the SqlServer provider is configured with
            // EnableRetryOnFailure() — a retrying execution strategy refuses user-initiated
            // transactions started any other way. The entity is loaded and mutated *inside* the
            // delegate (not captured from an outer load) so every retry attempt starts from a
            // fresh, actually-committed instance rather than reusing tracked-but-rolled-back state
            // from a prior failed attempt.
            Branch branch = null!;
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                branch = await db.Branches.Include(b => b.DiscountTiers).FirstAsync(b => b.Id == id);

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

                await using var transaction = await db.Database.BeginTransactionAsync();

                db.BranchDiscountTiers.RemoveRange(branch.DiscountTiers);
                branch.DiscountTiers.Clear();
                await db.SaveChangesAsync();

                // Adding the new tiers via the DbSet (not just the navigation collection) is required:
                // `branch` is already tracked as Unchanged from the query above, so EF's automatic
                // graph fixup for entities discovered only through its navigation — combined with
                // these entities having a non-default, client-set Guid key — infers EntityState.Modified
                // rather than Added, which generates a failing UPDATE (0 rows affected) instead of an
                // INSERT. Adding directly to the DbSet always marks the entity Added regardless of key.
                var newTiers = request.DiscountTiers.Select(tier => new BranchDiscountTier
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantContext.TenantId,
                    BranchId = branch.Id,
                    SessionCount = tier.SessionCount,
                    DiscountPerSession = tier.DiscountPerSession
                }).ToList();
                db.BranchDiscountTiers.AddRange(newTiers);
                branch.DiscountTiers = newTiers;

                await db.SaveChangesAsync();
                await transaction.CommitAsync();
            });

            return Results.Ok(ToResponse(branch));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == id);
            if (branch is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Branch not found");
            }

            var hasTherapyTypes = await db.TherapyTypes.AnyAsync(t => t.Status != TherapyTypeStatus.Deleted && t.Branches.Any(b => b.Id == id));
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
