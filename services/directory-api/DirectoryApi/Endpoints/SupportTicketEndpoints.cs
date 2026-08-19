using DirectoryApi.Common;
using DirectoryApi.Data;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tenancy;
using DirectoryApi.Validation;
using Microsoft.EntityFrameworkCore;

namespace DirectoryApi.Endpoints;

public static class SupportTicketEndpoints
{
    public static void MapSupportTicketEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/support-tickets");

        group.MapGet("", async (int? page, int? pageSize, SupportTicketRequesterType? requesterType, SupportTicketStatus? status, DirectoryDbContext db) =>
        {
            var currentPage = page is null or <= 0 ? 1 : page.Value;
            var currentPageSize = pageSize is null or <= 0 ? 20 : Math.Min(pageSize.Value, 100);

            var query = db.SupportTickets.Include(t => t.Messages).AsQueryable();

            if (requesterType is not null)
            {
                query = query.Where(t => t.RequesterType == requesterType);
            }

            if (status is not null)
            {
                query = query.Where(t => t.Status == status);
            }

            query = query.OrderByDescending(t => t.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query.Skip((currentPage - 1) * currentPageSize).Take(currentPageSize).ToListAsync();

            return Results.Ok(new PagedResult<SupportTicketResponse>
            {
                Items = items.Select(ToResponse).ToList(),
                Page = currentPage,
                PageSize = currentPageSize,
                TotalCount = totalCount
            });
        });

        group.MapGet("/{id:guid}", async (Guid id, DirectoryDbContext db) =>
        {
            var ticket = await db.SupportTickets.Include(t => t.Messages).FirstOrDefaultAsync(t => t.Id == id);
            return ticket is null
                ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Support ticket not found")
                : Results.Ok(ToResponse(ticket));
        });

        group.MapPost("", async (CreateSupportTicketRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var ticket = new SupportTicket
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                RequesterType = request.RequesterType!.Value,
                RequesterId = request.RequesterId,
                Category = request.Category,
                Title = request.Title,
                Status = SupportTicketStatus.WaitingForAdminReply,
                CreatedAt = DateTimeOffset.UtcNow
            };

            db.SupportTickets.Add(ticket);
            await db.SaveChangesAsync();

            return Results.Created($"/support-tickets/{ticket.Id}", ToResponse(ticket));
        });

        group.MapPost("/{id:guid}/messages", async (Guid id, AddSupportTicketMessageRequest request, DirectoryDbContext db, ITenantContext tenantContext) =>
        {
            var validationErrors = DataAnnotationsValidator.Validate(request);
            if (validationErrors is not null)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var ticket = await db.SupportTickets.Include(t => t.Messages).FirstOrDefaultAsync(t => t.Id == id);
            if (ticket is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Support ticket not found");
            }

            if (ticket.Status == SupportTicketStatus.Closed)
            {
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Support ticket is closed", detail: "Cannot add a message to a closed ticket.");
            }

            var message = new SupportTicketMessage
            {
                Id = Guid.NewGuid(),
                TenantId = tenantContext.TenantId,
                SupportTicketId = ticket.Id,
                SenderType = request.SenderType,
                Body = request.Body,
                CreatedAt = DateTimeOffset.UtcNow
            };

            ticket.Status = string.Equals(request.SenderType, "Admin", StringComparison.OrdinalIgnoreCase)
                ? SupportTicketStatus.WaitingForUserReply
                : SupportTicketStatus.WaitingForAdminReply;

            db.SupportTicketMessages.Add(message);
            await db.SaveChangesAsync();

            return Results.Created($"/support-tickets/{ticket.Id}", ToResponse(ticket));
        });

        group.MapPost("/{id:guid}/close", async (Guid id, DirectoryDbContext db) =>
        {
            var ticket = await db.SupportTickets.Include(t => t.Messages).FirstOrDefaultAsync(t => t.Id == id);
            if (ticket is null)
            {
                return Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Support ticket not found");
            }

            ticket.Status = SupportTicketStatus.Closed;
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(ticket));
        });
    }

    private static SupportTicketResponse ToResponse(SupportTicket ticket) => new()
    {
        Id = ticket.Id,
        RequesterType = ticket.RequesterType,
        RequesterId = ticket.RequesterId,
        Category = ticket.Category,
        Title = ticket.Title,
        Status = ticket.Status,
        Messages = ticket.Messages
            .OrderBy(m => m.CreatedAt)
            .Select(m => new SupportTicketMessageResponse
            {
                Id = m.Id,
                SenderType = m.SenderType,
                Body = m.Body,
                CreatedAt = m.CreatedAt
            })
            .ToList()
    };
}
