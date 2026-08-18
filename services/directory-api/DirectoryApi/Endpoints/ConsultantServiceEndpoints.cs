using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class ConsultantServiceEndpoints
{
    public static void MapConsultantServiceEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/consultant-services");

        group.MapGet("", async (int? page, int? pageSize, ConsultantStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.ConsultantServices.AsQueryable();
            if (status is not null)
            {
                query = query.Where(s => s.Status == status);
            }
            query = query.OrderBy(s => s.Name);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ConsultantServiceResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == id);
            return service is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant service not found")
                : Results.Ok(ToResponse(service));
        });

        group.MapPost("", async (CreateConsultantServiceRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var service = new ConsultantService
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                PhotoUrl = request.PhotoUrl,
                Status = ConsultantStatus.Active
            };

            db.ConsultantServices.Add(service);
            await db.SaveChangesAsync();

            return Results.Created($"/consultant-services/{service.Id}", ToResponse(service));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateConsultantServiceRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == id);
            if (service is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant service not found");
            }

            service.Name = request.Name;
            service.PhotoUrl = request.PhotoUrl;
            service.Status = request.Status!.Value;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(service));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == id);
            if (service is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant service not found");
            }

            service.Status = ConsultantStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ConsultantServiceResponse ToResponse(ConsultantService service) => new()
    {
        Id = service.Id,
        Name = service.Name,
        PhotoUrl = service.PhotoUrl,
        Status = service.Status
    };
}
