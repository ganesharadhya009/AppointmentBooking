using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class SessionWindowDto
{
    [Required]
    public SessionWindowName WindowName { get; set; }

    [Required]
    public TimeOnly StartTime { get; set; }

    [Required]
    public TimeOnly EndTime { get; set; }

    public decimal PricePerSession { get; set; }
}

public class AssignmentDto
{
    [Required]
    public Guid BranchId { get; set; }

    [Required]
    public Guid TherapyTypeId { get; set; }

    [Required]
    public DateOnly JoiningDate { get; set; }

    public DayOfWeek WeeklyDayOff { get; set; }

    public TimeOnly? LunchBreakStart { get; set; }
    public TimeOnly? LunchBreakEnd { get; set; }

    [Required]
    public required List<SessionWindowDto> SessionWindows { get; set; }
}

public class CreateTherapistRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required, MaxLength(20)]
    public required string MobileNumber { get; set; }

    [Required, MaxLength(200)]
    public required string Email { get; set; }

    [Required, MaxLength(100)]
    public required string LicenseNumber { get; set; }

    [MaxLength(20)]
    public string? Gender { get; set; }

    [Required, MaxLength(200)]
    public required string Designation { get; set; }

    public string? PhotoUrl { get; set; }
    public string? CertificateUrl { get; set; }
    public string? SignatureUrl { get; set; }

    [Required]
    public required List<AssignmentDto> Assignments { get; set; }
}

public class UpdateTherapistRequest : CreateTherapistRequest
{
    [Required]
    public TherapistStatus Status { get; set; }
}

public class AssignmentResponseDto
{
    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public Guid TherapyTypeId { get; set; }
    public DateOnly JoiningDate { get; set; }
    public DayOfWeek WeeklyDayOff { get; set; }
    public TimeOnly? LunchBreakStart { get; set; }
    public TimeOnly? LunchBreakEnd { get; set; }
    public required List<SessionWindowDto> SessionWindows { get; set; }
}

public class TherapistResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string MobileNumber { get; set; }
    public required string Email { get; set; }
    public required string LicenseNumber { get; set; }
    public string? Gender { get; set; }
    public required string Designation { get; set; }
    public string? PhotoUrl { get; set; }
    public string? CertificateUrl { get; set; }
    public string? SignatureUrl { get; set; }
    public TherapistStatus Status { get; set; }
    public required List<AssignmentResponseDto> Assignments { get; set; }
}
