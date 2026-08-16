using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class TenantEndpoints
{
    public static void MapTenantEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/tenants");

        group.MapPost("", async (CreateTenantRequest request, DirectoryDbContext db) =>
        {
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
            var tenant = await db.Tenants.FindAsync(id);
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
