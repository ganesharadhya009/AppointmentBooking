using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class HolidayEndpoints
{
    public static void MapHolidayEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/holidays");

        group.MapGet("", async (int? page, int? pageSize, Guid? branchId, DateOnly? from, DateOnly? to, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Holidays.AsQueryable();

            if (branchId is not null)
            {
                query = query.Where(h => h.BranchId == branchId);
            }

            if (from is not null)
            {
                query = query.Where(h => h.Date >= from);
            }

            if (to is not null)
            {
                query = query.Where(h => h.Date <= to);
            }

            query = query.OrderBy(h => h.Date);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<HolidayResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/is-closed", async (Guid branchId, DateOnly date, DirectoryDbContext db) =>
        {
            var isClosed = await db.Holidays.AnyAsync(h => h.BranchId == branchId && h.Date == date);
            return Results.Ok(new IsClosedResponse { IsClosed = isClosed });
        });

        group.MapPost("", async (CreateHolidayRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId);
            if (branch is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["branchId"] = ["Branch not found or does not belong to this tenant."]
                });
            }

            var duplicate = await db.Holidays.AnyAsync(h => h.BranchId == request.BranchId && h.Date == request.Date!.Value);
            if (duplicate)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Holiday already exists", detail: "A holiday already exists for this branch and date.");
            }

            var holiday = new Holiday
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                BranchId = request.BranchId,
                Date = request.Date!.Value,
                Reason = request.Reason
            };

            db.Holidays.Add(holiday);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Holiday already exists", detail: "A holiday already exists for this branch and date.");
            }

            return Results.Created($"/holidays/{holiday.Id}", ToResponse(holiday));
        });

        group.MapDelete("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var holiday = await db.Holidays.FirstOrDefaultAsync(h => h.Id == id);
            if (holiday is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Holiday not found");
            }

            db.Holidays.Remove(holiday);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation };

    private static HolidayResponse ToResponse(Holiday holiday) => new()
    {
        Id = holiday.Id,
        BranchId = holiday.BranchId,
        Date = holiday.Date,
        Reason = holiday.Reason
    };
}
