using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateLeaveRequestRequest
{
    [Required]
    public Guid TherapistId { get; set; }

    [Required]
    public DateOnly? StartDate { get; set; }

    [Required]
    public DateOnly? EndDate { get; set; }
}

public class LeaveRequestResponse
{
    public Guid Id { get; set; }
    public Guid TherapistId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public LeaveRequestStatus Status { get; set; }
    public string? ApprovedBy { get; set; }
}

public class IsOnLeaveResponse
{
    public bool IsOnLeave { get; set; }
}

public class ActiveLeaveCountResponse
{
    public int ActiveCount { get; set; }
}
