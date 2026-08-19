namespace DirectoryApi.Entities;

public enum LeaveRequestStatus
{
    Pending,
    Approved,
    Rejected
}

public class LeaveRequest
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid TherapistId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public LeaveRequestStatus Status { get; set; } = LeaveRequestStatus.Pending;
    public string? ApprovedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
