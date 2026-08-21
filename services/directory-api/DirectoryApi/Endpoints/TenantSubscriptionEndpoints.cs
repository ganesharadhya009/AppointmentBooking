using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

// SECURITY: same posture as TenantEndpoints.cs -- intentionally unauthenticated, trusted-network
// / internal-tooling only. Not a public self-serve signup surface. See design spec §2.
public static class TenantSubscriptionEndpoints
{
    public static void MapTenantSubscriptionEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/tenant-subscriptions");

        group.MapGet("", async (int? page, int? pageSize, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.TenantSubscriptions.OrderByDescending(s => s.CreatedAt).ThenBy(s => s.Id);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<TenantSubscriptionResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var subscription = await db.TenantSubscriptions.FirstOrDefaultAsync(s => s.Id == id);
            return subscription is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Tenant subscription not found")
                : Results.Ok(ToResponse(subscription));
        });

        group.MapPost("", async (CreateTenantSubscriptionRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == request.TenantId);
            if (tenant is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["tenantId"] = ["Tenant not found."] });
            }

            var existing = await db.TenantSubscriptions.AnyAsync(s => s.TenantId == request.TenantId);
            if (existing)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Subscription already exists", detail: "This tenant already has a subscription record.");
            }

            var subscription = new TenantSubscription
            {
                Id = Guid.NewGuid(),
                TenantId = request.TenantId,
                PlanName = request.PlanName,
                Status = request.Status!.Value,
                BillingCycle = request.BillingCycle!.Value,
                NextBillingDate = request.NextBillingDate!.Value,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.TenantSubscriptions.Add(subscription);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Subscription already exists", detail: "This tenant already has a subscription record.");
            }

            return Results.Created($"/tenant-subscriptions/{subscription.Id}", ToResponse(subscription));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateTenantSubscriptionRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var subscription = await db.TenantSubscriptions.FirstOrDefaultAsync(s => s.Id == id);
            if (subscription is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Tenant subscription not found");
            }

            subscription.PlanName = request.PlanName;
            subscription.Status = request.Status!.Value;
            subscription.BillingCycle = request.BillingCycle!.Value;
            subscription.NextBillingDate = request.NextBillingDate!.Value;
            await db.SaveChangesAsync();

            return Results.Ok(ToResponse(subscription));
        });
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation };

    private static TenantSubscriptionResponse ToResponse(TenantSubscription subscription) => new()
    {
        Id = subscription.Id,
        TenantId = subscription.TenantId,
        PlanName = subscription.PlanName,
        Status = subscription.Status,
        BillingCycle = subscription.BillingCycle,
        NextBillingDate = subscription.NextBillingDate,
        CreatedAt = subscription.CreatedAt
    };
}
