using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class ConsultantSessionWindowDto
{
    [Required]
    public SessionWindowName WindowName { get; set; }

    [Required]
    public TimeOnly StartTime { get; set; }

    [Required]
    public TimeOnly EndTime { get; set; }

    public decimal PricePerSession { get; set; }
}

public class CreateConsultantDoctorRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required]
    public Guid? ConsultantServiceId { get; set; }

    [Required]
    public decimal? ConsultationFee { get; set; }

    [MaxLength(20)]
    public string? Mobile { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(20)]
    public string? Gender { get; set; }

    [MaxLength(100)]
    public string? LicenseNumber { get; set; }

    [MaxLength(200)]
    public string? Qualification { get; set; }

    [Range(0, 100)]
    public int? ExperienceYears { get; set; }

    public string? PhotoUrl { get; set; }

    public DayOfWeek? DayOff { get; set; }

    public List<Guid> ClinicIds { get; set; } = [];

    public List<ConsultantSessionWindowDto> SessionWindows { get; set; } = [];
}

public class UpdateConsultantDoctorRequest : CreateConsultantDoctorRequest
{
    [Required]
    public ConsultantStatus? Status { get; set; }
}

public class ConsultantDoctorResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public decimal ConsultationFee { get; set; }
    public string? Mobile { get; set; }
    public string? Email { get; set; }
    public string? Gender { get; set; }
    public string? LicenseNumber { get; set; }
    public string? Qualification { get; set; }
    public int? ExperienceYears { get; set; }
    public string? PhotoUrl { get; set; }
    public DayOfWeek? DayOff { get; set; }
    public ConsultantStatus Status { get; set; }
    public List<Guid> ClinicIds { get; set; } = [];
    public List<ConsultantSessionWindowDto> SessionWindows { get; set; } = [];
}
