using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateSupportTicketRequest
{
    [Required]
    public SupportTicketRequesterType? RequesterType { get; set; }

    [Required]
    public Guid RequesterId { get; set; }

    [Required, MaxLength(200)]
    public required string Category { get; set; }

    [Required, MaxLength(200)]
    public required string Title { get; set; }
}

public class AddSupportTicketMessageRequest
{
    [Required, MaxLength(50)]
    public required string SenderType { get; set; }

    [Required]
    public required string Body { get; set; }
}

public class SupportTicketMessageResponse
{
    public Guid Id { get; set; }
    public required string SenderType { get; set; }
    public required string Body { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class SupportTicketResponse
{
    public Guid Id { get; set; }
    public SupportTicketRequesterType RequesterType { get; set; }
    public Guid RequesterId { get; set; }
    public required string Category { get; set; }
    public required string Title { get; set; }
    public SupportTicketStatus Status { get; set; }
    public List<SupportTicketMessageResponse> Messages { get; set; } = [];
}
