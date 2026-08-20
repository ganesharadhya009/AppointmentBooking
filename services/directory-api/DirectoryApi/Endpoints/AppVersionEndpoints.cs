using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

// SECURITY: platform-scoped, same caveat as TenantEndpoints.cs -- no user identity system exists
// yet, so these endpoints are intentionally unauthenticated. Anyone with a valid X-Tenant-Id can
// read/write every tenant's shared app-version records (there's only one set, platform-wide).
// Do NOT expose this service publicly until real Auth0 authorization is wired up.
public static class AppVersionEndpoints
{
    public static void MapAppVersionEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/app-versions");

        group.MapGet("", async (int? page, int? pageSize, TargetApp? targetApp, ReleaseStatus? releaseStatus, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.AppVersions.AsQueryable();
            if (targetApp is not null)
            {
                query = query.Where(a => a.TargetApp == targetApp.Value);
            }
            if (releaseStatus is not null)
            {
                query = query.Where(a => a.ReleaseStatus == releaseStatus.Value);
            }
            query = query.OrderByDescending(a => a.ReleaseDate).ThenBy(a => a.Id);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<AppVersionResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var appVersion = await db.AppVersions.FirstOrDefaultAsync(a => a.Id == id);
            return appVersion is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "App version not found")
                : Results.Ok(ToResponse(appVersion));
        });

        group.MapPost("", async (CreateAppVersionRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var appVersion = new AppVersion
            {
                Id = Guid.NewGuid(),
                TargetApp = request.TargetApp!.Value,
                VersionNumber = request.VersionNumber,
                ReleaseStatus = request.ReleaseStatus!.Value,
                RequireUpdate = request.RequireUpdate,
                ReleaseDate = request.ReleaseDate!.Value,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.AppVersions.Add(appVersion);
            await db.SaveChangesAsync();

            return Results.Created($"/app-versions/{appVersion.Id}", ToResponse(appVersion));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateAppVersionRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var appVersion = await db.AppVersions.FirstOrDefaultAsync(a => a.Id == id);
            if (appVersion is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "App version not found");
            }

            appVersion.TargetApp = request.TargetApp!.Value;
            appVersion.VersionNumber = request.VersionNumber;
            appVersion.ReleaseStatus = request.ReleaseStatus!.Value;
            appVersion.RequireUpdate = request.RequireUpdate;
            appVersion.ReleaseDate = request.ReleaseDate!.Value;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(appVersion));
        });
    }

    private static AppVersionResponse ToResponse(AppVersion appVersion) => new()
    {
        Id = appVersion.Id,
        TargetApp = appVersion.TargetApp,
        VersionNumber = appVersion.VersionNumber,
        ReleaseStatus = appVersion.ReleaseStatus,
        RequireUpdate = appVersion.RequireUpdate,
        ReleaseDate = appVersion.ReleaseDate,
        CreatedAt = appVersion.CreatedAt
    };
}
