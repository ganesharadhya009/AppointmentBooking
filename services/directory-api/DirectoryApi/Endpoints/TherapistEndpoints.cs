using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class TherapistEndpoints
{
    public static void MapTherapistEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/therapists");

        group.MapGet("", async (int? page, int? pageSize, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Therapists
                .Include(t => t.Assignments).ThenInclude(a => a.SessionWindows)
                .OrderBy(t => t.Name);
            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<TherapistResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var therapist = await db.Therapists
                .Include(t => t.Assignments).ThenInclude(a => a.SessionWindows)
                .FirstOrDefaultAsync(t => t.Id == id);
            return therapist is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist not found")
                : Results.Ok(ToResponse(therapist));
        });

        group.MapPost("", async (CreateTherapistRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (!TherapistValidator.IsValid(request.Assignments, out var error))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["assignments"] = [error!] });
            }

            var referenceErrors = await ValidateBranchAndTherapyTypeReferencesAsync(request.Assignments, db);
            if (referenceErrors is not null)
            {
                return Results.ValidationProblem(referenceErrors);
            }

            var therapist = new Therapist
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = request.Name,
                MobileNumber = request.MobileNumber,
                Email = request.Email,
                LicenseNumber = request.LicenseNumber,
                Gender = request.Gender,
                Designation = request.Designation,
                PhotoUrl = request.PhotoUrl,
                CertificateUrl = request.CertificateUrl,
                SignatureUrl = request.SignatureUrl,
                Status = TherapistStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system",
                Assignments = BuildAssignments(request.Assignments)
            };

            db.Therapists.Add(therapist);
            await db.SaveChangesAsync();

            return Results.Created($"/therapists/{therapist.Id}", ToResponse(therapist));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateTherapistRequest request, DirectoryDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (!TherapistValidator.IsValid(request.Assignments, out var error))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["assignments"] = [error!] });
            }

            var referenceErrors = await ValidateBranchAndTherapyTypeReferencesAsync(request.Assignments, db);
            if (referenceErrors is not null)
            {
                return Results.ValidationProblem(referenceErrors);
            }

            // A lightweight projection only (no tracked entity) — just enough to run the 404 and
            // deleted-reactivation checks. The actual entity used for the update is loaded fresh
            // inside the execution-strategy delegate below, so that a retried attempt after a
            // transient fault re-queries committed state instead of reusing a possibly-stale,
            // never-actually-committed in-memory instance (and its navigation collection) from the
            // failed attempt.
            var existingTherapist = await db.Therapists
                .Where(t => t.Id == id)
                .Select(t => new { t.Status })
                .FirstOrDefaultAsync();
            if (existingTherapist is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist not found");
            }

            if (existingTherapist.Status == TherapistStatus.Deleted && request.Status != TherapistStatus.Deleted)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["status"] = ["A deleted therapist cannot be reactivated."]
                });
            }

            // The delete-then-insert assignment replacement below is two separate
            // SaveChangesAsync calls (see BranchEndpoints.cs for why a single call can't
            // safely do both). Wrapping both in one transaction is what BranchEndpoints.cs's
            // equivalent code was found NOT to do in the prior plan's final review — that gap
            // is closed here, and retrofitted onto Branch in this same task's Step 4.
            // The transaction itself must run through the DbContext's execution strategy
            // (rather than a bare BeginTransactionAsync) because the SqlServer provider is
            // configured with EnableRetryOnFailure() — a retrying execution strategy refuses
            // user-initiated transactions started any other way. The entity is loaded and mutated
            // *inside* the delegate (not captured from an outer load) so every retry attempt starts
            // from a fresh, actually-committed instance rather than reusing tracked-but-rolled-back
            // state from a prior failed attempt.
            Therapist therapist = null!;
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                // Must be the first line in the delegate: `db` is the same DbContext instance
                // across retry attempts, so without clearing its change tracker, a tracking query
                // for an already-tracked key would hand back the *existing tracked instance* from
                // a prior failed attempt (with its in-memory, never-committed mutations still on
                // it) instead of fresh values reflecting the actually-committed (rolled-back) row.
                db.ChangeTracker.Clear();

                therapist = await db.Therapists
                    .Include(t => t.Assignments).ThenInclude(a => a.SessionWindows)
                    .FirstAsync(t => t.Id == id);

                therapist.Name = request.Name;
                therapist.MobileNumber = request.MobileNumber;
                therapist.Email = request.Email;
                therapist.LicenseNumber = request.LicenseNumber;
                therapist.Gender = request.Gender;
                therapist.Designation = request.Designation;
                therapist.PhotoUrl = request.PhotoUrl;
                therapist.CertificateUrl = request.CertificateUrl;
                therapist.SignatureUrl = request.SignatureUrl;
                therapist.Status = request.Status;

                await using var transaction = await db.Database.BeginTransactionAsync();

                var existingWindows = therapist.Assignments.SelectMany(a => a.SessionWindows).ToList();
                db.TherapistSessionWindows.RemoveRange(existingWindows);
                db.TherapistAssignments.RemoveRange(therapist.Assignments);
                therapist.Assignments.Clear();
                await db.SaveChangesAsync();

                var newAssignments = BuildAssignments(request.Assignments);
                foreach (var assignment in newAssignments)
                {
                    assignment.TherapistId = therapist.Id;
                }
                db.TherapistAssignments.AddRange(newAssignments);
                db.TherapistSessionWindows.AddRange(newAssignments.SelectMany(a => a.SessionWindows));
                therapist.Assignments = newAssignments;
                await db.SaveChangesAsync();

                await transaction.CommitAsync();
            });

            return Results.Ok(ToResponse(therapist));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var therapist = await db.Therapists.FirstOrDefaultAsync(t => t.Id == id);
            if (therapist is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Therapist not found");
            }

            therapist.Status = TherapistStatus.Deleted;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static async Task<Dictionary<string, string[]>?> ValidateBranchAndTherapyTypeReferencesAsync(
        List<AssignmentDto> assignments, DirectoryDbContext db)
    {
        var branchIds = assignments.Select(a => a.BranchId).Distinct().ToList();
        var therapyTypeIds = assignments.Select(a => a.TherapyTypeId).Distinct().ToList();

        var foundBranchCount = await db.Branches.CountAsync(b => branchIds.Contains(b.Id));
        var foundTherapyTypeCount = await db.TherapyTypes.CountAsync(t => therapyTypeIds.Contains(t.Id));

        var errors = new Dictionary<string, string[]>();
        if (foundBranchCount != branchIds.Count)
        {
            errors["assignments"] = ["One or more branch IDs were not found or do not belong to this tenant."];
        }
        if (foundTherapyTypeCount != therapyTypeIds.Count)
        {
            errors["assignments"] = errors.TryGetValue("assignments", out var existing)
                ? [.. existing, "One or more therapy type IDs were not found or do not belong to this tenant."]
                : ["One or more therapy type IDs were not found or do not belong to this tenant."];
        }

        return errors.Count > 0 ? errors : null;
    }

    private static List<TherapistAssignment> BuildAssignments(List<AssignmentDto> dtos) =>
        dtos.Select(a =>
        {
            var assignmentId = Guid.NewGuid();
            return new TherapistAssignment
            {
                Id = assignmentId,
                BranchId = a.BranchId,
                TherapyTypeId = a.TherapyTypeId,
                JoiningDate = a.JoiningDate,
                WeeklyDayOff = a.WeeklyDayOff,
                LunchBreakStart = a.LunchBreakStart,
                LunchBreakEnd = a.LunchBreakEnd,
                SessionWindows = a.SessionWindows.Select(w => new TherapistSessionWindow
                {
                    Id = Guid.NewGuid(),
                    AssignmentId = assignmentId,
                    WindowName = w.WindowName,
                    StartTime = w.StartTime,
                    EndTime = w.EndTime,
                    PricePerSession = w.PricePerSession
                }).ToList()
            };
        }).ToList();

    private static TherapistResponse ToResponse(Therapist therapist) => new()
    {
        Id = therapist.Id,
        Name = therapist.Name,
        MobileNumber = therapist.MobileNumber,
        Email = therapist.Email,
        LicenseNumber = therapist.LicenseNumber,
        Gender = therapist.Gender,
        Designation = therapist.Designation,
        PhotoUrl = therapist.PhotoUrl,
        CertificateUrl = therapist.CertificateUrl,
        SignatureUrl = therapist.SignatureUrl,
        Status = therapist.Status,
        Assignments = therapist.Assignments.Select(a => new AssignmentResponseDto
        {
            Id = a.Id,
            BranchId = a.BranchId,
            TherapyTypeId = a.TherapyTypeId,
            JoiningDate = a.JoiningDate,
            WeeklyDayOff = a.WeeklyDayOff,
            LunchBreakStart = a.LunchBreakStart,
            LunchBreakEnd = a.LunchBreakEnd,
            SessionWindows = a.SessionWindows.Select(w => new SessionWindowDto
            {
                WindowName = w.WindowName,
                StartTime = w.StartTime,
                EndTime = w.EndTime,
                PricePerSession = w.PricePerSession
            }).ToList()
        }).ToList()
    };
}
