namespace DirectoryApi.Entities;

public enum TherapistStatus
{
    Active,
    Inactive,
    Deleted
}

public class Therapist
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public required string MobileNumber { get; set; }
    public required string Email { get; set; }
    public required string LicenseNumber { get; set; }
    public string? Gender { get; set; }
    public required string Designation { get; set; }
    public string? PhotoUrl { get; set; }
    public string? CertificateUrl { get; set; }
    public string? SignatureUrl { get; set; }
    public TherapistStatus Status { get; set; } = TherapistStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public required string CreatedBy { get; set; }

    public List<TherapistAssignment> Assignments { get; set; } = [];
}
