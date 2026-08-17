using ClientRecordsApi.Common;
using ClientRecordsApi.Data;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tenancy;
using ClientRecordsApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace ClientRecordsApi.Endpoints;

public static class ParentEndpoints
{
    public static void MapParentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/parents");

        group.MapGet("", async (int? page, int? pageSize, ClientRecordsDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Parents.OrderBy(p => p.Name);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ParentResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var parent = await db.Parents.FirstOrDefaultAsync(p => p.Id == id);
            return parent is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Parent not found")
                : Results.Ok(ToResponse(parent));
        });

        group.MapPost("", async (CreateParentRequest request, ClientRecordsDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var parent = new Parent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                MobileNumber = request.MobileNumber,
                Email = request.Email,
                Address = request.Address,
                City = request.City,
                State = request.State,
                Country = request.Country,
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            db.Parents.Add(parent);
            await db.SaveChangesAsync();

            return Results.Created($"/parents/{parent.Id}", ToResponse(parent));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateParentRequest request, ClientRecordsDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var parent = await db.Parents.FirstOrDefaultAsync(p => p.Id == id);
            if (parent is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Parent not found");
            }

            parent.Name = request.Name;
            parent.MobileNumber = request.MobileNumber;
            parent.Email = request.Email;
            parent.Address = request.Address;
            parent.City = request.City;
            parent.State = request.State;
            parent.Country = request.Country;
            parent.Status = request.Status!.Value;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(parent));
        });

        group.MapDelete("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var parent = await db.Parents.FirstOrDefaultAsync(p => p.Id == id);
            if (parent is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Parent not found");
            }

            parent.Status = ClientStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ParentResponse ToResponse(Parent parent) => new()
    {
        Id = parent.Id,
        Name = parent.Name,
        MobileNumber = parent.MobileNumber,
        Email = parent.Email,
        Address = parent.Address,
        City = parent.City,
        State = parent.State,
        Country = parent.Country,
        Status = parent.Status
    };
}
