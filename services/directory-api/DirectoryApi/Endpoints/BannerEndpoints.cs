using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class BannerEndpoints
{
    public static void MapBannerEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/banners");

        group.MapGet("", async (int? page, int? pageSize, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Banners.OrderByDescending(b => b.CreatedAt).ThenBy(b => b.Id);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<BannerResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var banner = await db.Banners.FirstOrDefaultAsync(b => b.Id == id);
            return banner is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Banner not found")
                : Results.Ok(ToResponse(banner));
        });

        group.MapPost("", async (CreateBannerRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var banner = new Banner
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ImageUrl = request.ImageUrl,
                WatermarkTitle = request.WatermarkTitle,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.Banners.Add(banner);
            await db.SaveChangesAsync();

            return Results.Created($"/banners/{banner.Id}", ToResponse(banner));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateBannerRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var banner = await db.Banners.FirstOrDefaultAsync(b => b.Id == id);
            if (banner is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Banner not found");
            }

            banner.ImageUrl = request.ImageUrl;
            banner.WatermarkTitle = request.WatermarkTitle;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(banner));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var banner = await db.Banners.FirstOrDefaultAsync(b => b.Id == id);
            if (banner is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Banner not found");
            }

            db.Banners.Remove(banner);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static BannerResponse ToResponse(Banner banner) => new()
    {
        Id = banner.Id,
        ImageUrl = banner.ImageUrl,
        WatermarkTitle = banner.WatermarkTitle,
        CreatedAt = banner.CreatedAt
    };
}
