namespace DirectoryApi.Entities;

public class ConsultantDoctor
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public decimal ConsultationFee { get; set; }
    public ConsultantStatus Status { get; set; } = ConsultantStatus.Active;

    public string? Mobile { get; set; }
    public string? Email { get; set; }
    public string? Gender { get; set; }
    public string? LicenseNumber { get; set; }
    public string? Qualification { get; set; }
    public int? ExperienceYears { get; set; }
    public string? PhotoUrl { get; set; }
    public DayOfWeek? DayOff { get; set; }

    // Many-to-many -- a consultant doctor can practice out of more than one partner clinic,
    // mirroring TherapyType.Branches (see DirectoryDbContext.cs).
    public List<ConsultantClinic> Clinics { get; set; } = [];

    // Flat, doctor-wide session windows (not per-clinic) -- reuses the same
    // SessionWindowName/StartTime/EndTime/PricePerSession shape as TherapistSessionWindow.
    public List<ConsultantDoctorSessionWindow> SessionWindows { get; set; } = [];
}
