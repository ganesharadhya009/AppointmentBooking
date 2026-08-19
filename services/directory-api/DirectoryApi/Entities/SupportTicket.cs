namespace DirectoryApi.Entities;

public enum SupportTicketRequesterType
{
    Parent,
    Therapist
}

public enum SupportTicketStatus
{
    WaitingForAdminReply,
    WaitingForUserReply,
    Closed
}

public class SupportTicket
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public SupportTicketRequesterType RequesterType { get; set; }
    public Guid RequesterId { get; set; }
    public required string Category { get; set; }
    public required string Title { get; set; }
    public SupportTicketStatus Status { get; set; } = SupportTicketStatus.WaitingForAdminReply;
    public DateTimeOffset CreatedAt { get; set; }

    public List<SupportTicketMessage> Messages { get; set; } = [];
}

public class SupportTicketMessage
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SupportTicketId { get; set; }
    public required string SenderType { get; set; }
    public required string Body { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
