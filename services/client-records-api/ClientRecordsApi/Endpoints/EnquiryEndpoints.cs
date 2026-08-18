using ClientRecordsApi.Common;
using ClientRecordsApi.Data;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tenancy;
using ClientRecordsApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace ClientRecordsApi.Endpoints;

public static class EnquiryEndpoints
{
    public static void MapEnquiryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/enquiries");

        group.MapGet("", async (int? page, int? pageSize, EnquiryStatus? status, DateTimeOffset? from, DateTimeOffset? to, string? contactNumber, ClientRecordsDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.Enquiries.AsQueryable();

            if (status is not null)
            {
                query = query.Where(e => e.Status == status);
            }

            if (from is not null)
            {
                query = query.Where(e => e.CreatedAt >= from);
            }

            if (to is not null)
            {
                query = query.Where(e => e.CreatedAt <= to);
            }

            if (!string.IsNullOrWhiteSpace(contactNumber))
            {
                query = query.Where(e => e.ParentMobileNumber == contactNumber);
            }

            query = query.OrderByDescending(e => e.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<EnquiryResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, ClientRecordsDbContext db) =>
        {
            var enquiry = await db.Enquiries.FirstOrDefaultAsync(e => e.Id == id);
            return enquiry is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Enquiry not found")
                : Results.Ok(ToResponse(enquiry));
        });

        group.MapPost("", async (CreateEnquiryRequest request, ClientRecordsDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            if (request.Status == EnquiryStatus.Converted)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["status"] = ["An enquiry cannot be created with Converted status."]
                });
            }

            var enquiry = new Enquiry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ParentName = request.ParentName,
                ParentMobileNumber = request.ParentMobileNumber,
                ParentEmail = request.ParentEmail,
                ChildName = request.ChildName,
                ChildDateOfBirth = request.ChildDateOfBirth,
                ChildGender = request.ChildGender,
                PreferredTherapy = request.PreferredTherapy,
                PreferredLocation = request.PreferredLocation,
                Address = request.Address,
                City = request.City,
                State = request.State,
                Country = request.Country,
                Concerns = request.Concerns,
                DiagnosisReportUrl = request.DiagnosisReportUrl,
                ParentIdCardUrl = request.ParentIdCardUrl,
                Status = request.Status ?? EnquiryStatus.Draft,
                FollowUpDate = request.FollowUpDate,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            db.Enquiries.Add(enquiry);
            await db.SaveChangesAsync();

            return Results.Created($"/enquiries/{enquiry.Id}", ToResponse(enquiry));
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateEnquiryRequest request, ClientRecordsDbContext db) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var enquiry = await db.Enquiries.FirstOrDefaultAsync(e => e.Id == id);
            if (enquiry is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Enquiry not found");
            }

            if (enquiry.Status == EnquiryStatus.Converted)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Enquiry already converted", detail: "A converted enquiry cannot be edited.");
            }

            if (request.Status == EnquiryStatus.Converted)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["status"] = ["Use POST /enquiries/{id}/convert to convert an enquiry; status cannot be set to Converted directly."]
                });
            }

            enquiry.ParentName = request.ParentName;
            enquiry.ParentMobileNumber = request.ParentMobileNumber;
            enquiry.ParentEmail = request.ParentEmail;
            enquiry.ChildName = request.ChildName;
            enquiry.ChildDateOfBirth = request.ChildDateOfBirth;
            enquiry.ChildGender = request.ChildGender;
            enquiry.PreferredTherapy = request.PreferredTherapy;
            enquiry.PreferredLocation = request.PreferredLocation;
            enquiry.Address = request.Address;
            enquiry.City = request.City;
            enquiry.State = request.State;
            enquiry.Country = request.Country;
            enquiry.Concerns = request.Concerns;
            enquiry.DiagnosisReportUrl = request.DiagnosisReportUrl;
            enquiry.ParentIdCardUrl = request.ParentIdCardUrl;
            enquiry.FollowUpDate = request.FollowUpDate;
            if (request.Status is not null)
            {
                enquiry.Status = request.Status.Value;
            }

            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(enquiry));
        });

        group.MapPost("/{id:guid}/convert", async (Guid id, ClientRecordsDbContext db, ITenantContext tenantContext) =>
        {
            var enquiry = await db.Enquiries.FirstOrDefaultAsync(e => e.Id == id);
            if (enquiry is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Enquiry not found");
            }

            if (enquiry.Status == EnquiryStatus.Converted)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Enquiry already converted", detail: "This enquiry has already been converted to a client.");
            }

            if (string.IsNullOrWhiteSpace(enquiry.ParentEmail))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["parentEmail"] = ["Parent email is required before an enquiry can be converted."]
                });
            }

            if (enquiry.ChildDateOfBirth is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["childDateOfBirth"] = ["Child date of birth is required before an enquiry can be converted."]
                });
            }

            var parent = new Parent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                Name = enquiry.ParentName,
                MobileNumber = enquiry.ParentMobileNumber,
                Email = enquiry.ParentEmail!,
                Address = enquiry.Address,
                City = enquiry.City,
                State = enquiry.State,
                Country = enquiry.Country,
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            var child = new Child
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                ParentId = parent.Id,
                Name = enquiry.ChildName,
                DateOfBirth = enquiry.ChildDateOfBirth!.Value,
                Gender = enquiry.ChildGender,
                Status = ClientStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedBy = "system"
            };

            enquiry.Status = EnquiryStatus.Converted;
            enquiry.ConvertedParentId = parent.Id;
            enquiry.ConvertedChildId = child.Id;

            db.Parents.Add(parent);
            db.Children.Add(child);
            await db.SaveChangesAsync();

            return Results.Ok(new ConvertEnquiryResponse
            {
                EnquiryId = enquiry.Id,
                ParentId = parent.Id,
                ChildId = child.Id
            });
        });
    }

    private static EnquiryResponse ToResponse(Enquiry enquiry) => new()
    {
        Id = enquiry.Id,
        ParentName = enquiry.ParentName,
        ParentMobileNumber = enquiry.ParentMobileNumber,
        ParentEmail = enquiry.ParentEmail,
        ChildName = enquiry.ChildName,
        ChildDateOfBirth = enquiry.ChildDateOfBirth,
        ChildGender = enquiry.ChildGender,
        PreferredTherapy = enquiry.PreferredTherapy,
        PreferredLocation = enquiry.PreferredLocation,
        Address = enquiry.Address,
        City = enquiry.City,
        State = enquiry.State,
        Country = enquiry.Country,
        Concerns = enquiry.Concerns,
        DiagnosisReportUrl = enquiry.DiagnosisReportUrl,
        ParentIdCardUrl = enquiry.ParentIdCardUrl,
        Status = enquiry.Status,
        FollowUpDate = enquiry.FollowUpDate,
        ConvertedParentId = enquiry.ConvertedParentId,
        ConvertedChildId = enquiry.ConvertedChildId
    };
}
