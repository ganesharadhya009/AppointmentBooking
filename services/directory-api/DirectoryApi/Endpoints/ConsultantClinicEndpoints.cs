using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class ConsultantClinicEndpoints
{
    public static void MapConsultantClinicEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/consultant-clinics");

        group.MapGet("", async (int? page, int? pageSize, string? state, string? city, ConsultantStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.ConsultantClinics.AsQueryable();

            if (!string.IsNullOrWhiteSpace(state))
            {
                query = query.Where(c => c.State == state);
            }

            if (!string.IsNullOrWhiteSpace(city))
            {
                query = query.Where(c => c.City == city);
            }

            if (status is not null)
            {
                query = query.Where(c => c.Status == status);
            }

            query = query.OrderBy(c => c.Name);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ConsultantClinicResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == id);
            return clinic is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant clinic not found")
                : Results.Ok(ToResponse(clinic));
        });

        group.MapPost("", async (CreateConsultantClinicRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var clinic = new ConsultantClinic
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                Address = request.Address,
                City = request.City,
                State = request.State,
                Country = request.Country,
                LeadContactName = request.LeadContactName,
                LeadContactPhone = request.LeadContactPhone,
                Status = ConsultantStatus.Active
            };

            db.ConsultantClinics.Add(clinic);
            await db.SaveChangesAsync();

            return Results.Created($"/consultant-clinics/{clinic.Id}", ToResponse(clinic));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateConsultantClinicRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == id);
            if (clinic is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant clinic not found");
            }

            clinic.Name = request.Name;
            clinic.Address = request.Address;
            clinic.City = request.City;
            clinic.State = request.State;
            clinic.Country = request.Country;
            clinic.LeadContactName = request.LeadContactName;
            clinic.LeadContactPhone = request.LeadContactPhone;
            clinic.Status = request.Status!.Value;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(clinic));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == id);
            if (clinic is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant clinic not found");
            }

            clinic.Status = ConsultantStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ConsultantClinicResponse ToResponse(ConsultantClinic clinic) => new()
    {
        Id = clinic.Id,
        Name = clinic.Name,
        Address = clinic.Address,
        City = clinic.City,
        State = clinic.State,
        Country = clinic.Country,
        LeadContactName = clinic.LeadContactName,
        LeadContactPhone = clinic.LeadContactPhone,
        Status = clinic.Status
    };
}
