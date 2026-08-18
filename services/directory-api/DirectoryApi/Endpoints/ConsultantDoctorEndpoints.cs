using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class ConsultantDoctorEndpoints
{
    public static void MapConsultantDoctorEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/consultant-doctors");

        group.MapGet("", async (int? page, int? pageSize, Guid? consultantServiceId, string? city, ConsultantStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.ConsultantDoctors.AsQueryable();

            if (consultantServiceId is not null)
            {
                query = query.Where(d => d.ConsultantServiceId == consultantServiceId);
            }

            if (status is not null)
            {
                query = query.Where(d => d.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(city))
            {
                var clinicIdsInCity = db.ConsultantClinics.Where(c => c.City == city).Select(c => c.Id);
                query = query.Where(d => clinicIdsInCity.Contains(d.ConsultantClinicId));
            }

            query = query.OrderBy(d => d.Name);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<ConsultantDoctorResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var doctor = await db.ConsultantDoctors.FirstOrDefaultAsync(d => d.Id == id);
            return doctor is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant doctor not found")
                : Results.Ok(ToResponse(doctor));
        });

        group.MapPost("", async (CreateConsultantDoctorRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == request.ConsultantServiceId);
            if (service is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantServiceId"] = ["Consultant service not found or does not belong to this tenant."]
                });
            }

            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == request.ConsultantClinicId);
            if (clinic is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantClinicId"] = ["Consultant clinic not found or does not belong to this tenant."]
                });
            }

            var doctor = new ConsultantDoctor
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                ConsultantServiceId = request.ConsultantServiceId,
                ConsultantClinicId = request.ConsultantClinicId,
                ConsultationFee = request.ConsultationFee!.Value,
                Status = ConsultantStatus.Active
            };

            db.ConsultantDoctors.Add(doctor);
            await db.SaveChangesAsync();

            return Results.Created($"/consultant-doctors/{doctor.Id}", ToResponse(doctor));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateConsultantDoctorRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var doctor = await db.ConsultantDoctors.FirstOrDefaultAsync(d => d.Id == id);
            if (doctor is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant doctor not found");
            }

            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == request.ConsultantServiceId);
            if (service is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantServiceId"] = ["Consultant service not found or does not belong to this tenant."]
                });
            }

            var clinic = await db.ConsultantClinics.FirstOrDefaultAsync(c => c.Id == request.ConsultantClinicId);
            if (clinic is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantClinicId"] = ["Consultant clinic not found or does not belong to this tenant."]
                });
            }

            doctor.Name = request.Name;
            doctor.ConsultantServiceId = request.ConsultantServiceId;
            doctor.ConsultantClinicId = request.ConsultantClinicId;
            doctor.ConsultationFee = request.ConsultationFee!.Value;
            doctor.Status = request.Status!.Value;

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(doctor));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var doctor = await db.ConsultantDoctors.FirstOrDefaultAsync(d => d.Id == id);
            if (doctor is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant doctor not found");
            }

            doctor.Status = ConsultantStatus.Inactive;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static ConsultantDoctorResponse ToResponse(ConsultantDoctor doctor) => new()
    {
        Id = doctor.Id,
        Name = doctor.Name,
        ConsultantServiceId = doctor.ConsultantServiceId,
        ConsultantClinicId = doctor.ConsultantClinicId,
        ConsultationFee = doctor.ConsultationFee,
        Status = doctor.Status
    };
}
