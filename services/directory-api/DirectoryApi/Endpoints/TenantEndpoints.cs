using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class TenantEndpoints
{
    // SECURITY: these endpoints are intentionally unauthenticated for now — no user
    // identity system exists yet (see design spec §7, "Migration to Real Auth").
    // Do NOT expose this service publicly until real Auth0 authorization is wired
    // up here; until then, /tenants must only be reachable from a trusted network
    // (internal tooling / onboarding pipeline), not the public internet.
    public static void MapTenantEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/tenants");

        group.MapPost("", async (CreateTenantRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = request.Name,
                SubscriptionStatus = SubscriptionStatus.Trial,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.Tenants.Add(tenant);
            await db.SaveChangesAsync();

            return Results.Created($"/tenants/{tenant.Id}", ToResponse(tenant));
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == id);
            return tenant is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Tenant not found")
                : Results.Ok(ToResponse(tenant));
        });
    }

    private static TenantResponse ToResponse(Tenant tenant) => new()
    {
        Id = tenant.Id,
        Name = tenant.Name,
        SubscriptionStatus = tenant.SubscriptionStatus,
        CreatedAt = tenant.CreatedAt
    };
}
