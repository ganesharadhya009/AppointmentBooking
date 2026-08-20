using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class PosterEndpoints
{
    public static void MapPosterEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/posters");

        group.MapGet("", async (int? page, int? pageSize, bool? isActive, PosterPosition? position, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Posters.AsQueryable();
            if (isActive is not null)
            {
                query = query.Where(p => p.IsActive == isActive.Value);
            }
            if (position is not null)
            {
                query = query.Where(p => p.Position == position.Value);
            }
            query = query.OrderByDescending(p => p.Priority).ThenByDescending(p => p.CreatedAt).ThenBy(p => p.Id);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<PosterResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var poster = await db.Posters.FirstOrDefaultAsync(p => p.Id == id);
            return poster is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Poster not found")
                : Results.Ok(ToResponse(poster));
        });

        group.MapPost("", async (CreatePosterRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var poster = new Poster
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Type = request.Type,
                Position = request.Position!.Value,
                ActiveFrom = request.ActiveFrom!.Value,
                ActiveTo = request.ActiveTo!.Value,
                Priority = request.Priority,
                IsActive = request.IsActive,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.Posters.Add(poster);
            await db.SaveChangesAsync();

            return Results.Created($"/posters/{poster.Id}", ToResponse(poster));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdatePosterRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var poster = await db.Posters.FirstOrDefaultAsync(p => p.Id == id);
            if (poster is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Poster not found");
            }

            poster.Type = request.Type;
            poster.Position = request.Position!.Value;
            poster.ActiveFrom = request.ActiveFrom!.Value;
            poster.ActiveTo = request.ActiveTo!.Value;
            poster.Priority = request.Priority;
            poster.IsActive = request.IsActive;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(poster));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var poster = await db.Posters.FirstOrDefaultAsync(p => p.Id == id);
            if (poster is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Poster not found");
            }

            db.Posters.Remove(poster);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static PosterResponse ToResponse(Poster poster) => new()
    {
        Id = poster.Id,
        Type = poster.Type,
        Position = poster.Position,
        ActiveFrom = poster.ActiveFrom,
        ActiveTo = poster.ActiveTo,
        Priority = poster.Priority,
        IsActive = poster.IsActive,
        CreatedAt = poster.CreatedAt
    };
}
