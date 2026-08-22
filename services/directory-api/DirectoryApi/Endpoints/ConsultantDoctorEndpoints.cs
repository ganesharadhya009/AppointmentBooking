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

            var query = db.ConsultantDoctors
                .Include(d => d.Clinics)
                .Include(d => d.SessionWindows)
                .AsQueryable();

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
                query = query.Where(d => d.Clinics.Any(c => c.City == city));
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
            var doctor = await db.ConsultantDoctors
                .Include(d => d.Clinics)
                .Include(d => d.SessionWindows)
                .FirstOrDefaultAsync(d => d.Id == id);
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

            if (!ConsultantDoctorValidator.IsValid(request.SessionWindows, out var windowError))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["sessionWindows"] = [windowError!] });
            }

            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == request.ConsultantServiceId);
            if (service is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantServiceId"] = ["Consultant service not found or does not belong to this tenant."]
                });
            }

            var clinics = await db.ConsultantClinics.Where(c => request.ClinicIds.Contains(c.Id)).ToListAsync();
            if (clinics.Count != request.ClinicIds.Distinct().Count())
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["clinicIds"] = ["One or more clinic IDs were not found or do not belong to this tenant."]
                });
            }

            var doctor = new ConsultantDoctor
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                ConsultantServiceId = request.ConsultantServiceId!.Value,
                ConsultationFee = request.ConsultationFee!.Value,
                Status = ConsultantStatus.Active,
                Mobile = request.Mobile,
                Email = request.Email,
                Gender = request.Gender,
                LicenseNumber = request.LicenseNumber,
                Qualification = request.Qualification,
                ExperienceYears = request.ExperienceYears,
                PhotoUrl = request.PhotoUrl,
                DayOff = request.DayOff,
                Clinics = clinics,
                SessionWindows = BuildSessionWindows(request.SessionWindows, tenantContext.TenantId)
            };

            db.ConsultantDoctors.Add(doctor);
            await db.SaveChangesAsync();

            return Results.Created($"/consultant-doctors/{doctor.Id}", ToResponse(doctor));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateConsultantDoctorRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (!ConsultantDoctorValidator.IsValid(request.SessionWindows, out var windowError))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["sessionWindows"] = [windowError!] });
            }

            var service = await db.ConsultantServices.FirstOrDefaultAsync(s => s.Id == request.ConsultantServiceId);
            if (service is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["consultantServiceId"] = ["Consultant service not found or does not belong to this tenant."]
                });
            }

            var clinics = await db.ConsultantClinics.Where(c => request.ClinicIds.Contains(c.Id)).ToListAsync();
            if (clinics.Count != request.ClinicIds.Distinct().Count())
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["clinicIds"] = ["One or more clinic IDs were not found or do not belong to this tenant."]
                });
            }

            var doctorExists = await db.ConsultantDoctors.AnyAsync(d => d.Id == id);
            if (!doctorExists)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultant doctor not found");
            }

            // Same delete-then-insert-in-two-SaveChanges-calls-inside-one-transaction pattern as
            // BranchEndpoints.cs's discount tier replacement: SessionWindows carries a unique
            // (TenantId, ConsultantDoctorId, WindowName) index, so an insert-before-delete
            // ordering (which EF doesn't guarantee within one SaveChangesAsync) would collide with
            // the still-present old row for the same window name. The transaction runs through the
            // execution strategy (not a bare BeginTransactionAsync) because Npgsql is configured
            // with EnableRetryOnFailure(), which refuses user-started transactions any other way.
            ConsultantDoctor doctor = null!;
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                // Must be the first line in the delegate (see BranchEndpoints.cs / TherapistEndpoints.cs
                // for the same pattern): without clearing the tracker, the `clinics` list loaded above
                // (before this delegate, and thus before any retry) would still be tracked from a prior
                // attempt when re-assigned to `doctor.Clinics` below, conflicting with the fresh
                // `Include(d => d.Clinics)` load on the next line -- two different tracked instances for
                // the same ConsultantClinic.Id. Re-querying `clinics` here, after the clear, keeps
                // exactly one tracked instance per entity.
                db.ChangeTracker.Clear();
                clinics = await db.ConsultantClinics.Where(c => request.ClinicIds.Contains(c.Id)).ToListAsync();

                doctor = await db.ConsultantDoctors
                    .Include(d => d.Clinics)
                    .Include(d => d.SessionWindows)
                    .FirstAsync(d => d.Id == id);

                doctor.Name = request.Name;
                doctor.ConsultantServiceId = request.ConsultantServiceId!.Value;
                doctor.ConsultationFee = request.ConsultationFee!.Value;
                doctor.Status = request.Status!.Value;
                doctor.Mobile = request.Mobile;
                doctor.Email = request.Email;
                doctor.Gender = request.Gender;
                doctor.LicenseNumber = request.LicenseNumber;
                doctor.Qualification = request.Qualification;
                doctor.ExperienceYears = request.ExperienceYears;
                doctor.PhotoUrl = request.PhotoUrl;
                doctor.DayOff = request.DayOff;
                doctor.Clinics = clinics;

                await using var transaction = await db.Database.BeginTransactionAsync();

                db.ConsultantDoctorSessionWindows.RemoveRange(doctor.SessionWindows);
                doctor.SessionWindows.Clear();
                await db.SaveChangesAsync();

                var newWindows = BuildSessionWindows(request.SessionWindows, tenantContext.TenantId);
                foreach (var window in newWindows)
                {
                    window.ConsultantDoctorId = doctor.Id;
                }
                db.ConsultantDoctorSessionWindows.AddRange(newWindows);
                doctor.SessionWindows = newWindows;

                await db.SaveChangesAsync();
                await transaction.CommitAsync();
            });

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

    private static List<ConsultantDoctorSessionWindow> BuildSessionWindows(List<ConsultantSessionWindowDto> dtos, Guid tenantId) =>
        dtos.Select(w => new ConsultantDoctorSessionWindow
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            WindowName = w.WindowName,
            StartTime = w.StartTime,
            EndTime = w.EndTime,
            PricePerSession = w.PricePerSession
        }).ToList();

    private static ConsultantDoctorResponse ToResponse(ConsultantDoctor doctor) => new()
    {
        Id = doctor.Id,
        Name = doctor.Name,
        ConsultantServiceId = doctor.ConsultantServiceId,
        ConsultationFee = doctor.ConsultationFee,
        Status = doctor.Status,
        Mobile = doctor.Mobile,
        Email = doctor.Email,
        Gender = doctor.Gender,
        LicenseNumber = doctor.LicenseNumber,
        Qualification = doctor.Qualification,
        ExperienceYears = doctor.ExperienceYears,
        PhotoUrl = doctor.PhotoUrl,
        DayOff = doctor.DayOff,
        ClinicIds = doctor.Clinics.Select(c => c.Id).ToList(),
        SessionWindows = doctor.SessionWindows.Select(w => new ConsultantSessionWindowDto
        {
            WindowName = w.WindowName,
            StartTime = w.StartTime,
            EndTime = w.EndTime,
            PricePerSession = w.PricePerSession
        }).ToList()
    };
}
