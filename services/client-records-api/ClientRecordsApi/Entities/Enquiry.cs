namespace ClientRecordsApi.Entities;

public enum EnquiryStatus
{
    Draft,
    Submitted,
    Converted
}

public class Enquiry
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string ParentName { get; set; }
    public required string ParentMobileNumber { get; set; }
    public string? ParentEmail { get; set; }
    public required string ChildName { get; set; }
    public DateOnly? ChildDateOfBirth { get; set; }
    public string? ChildGender { get; set; }
    public string? PreferredTherapy { get; set; }
    public string? PreferredLocation { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public List<string> Concerns { get; set; } = [];
    public string? DiagnosisReportUrl { get; set; }
    public string? ParentIdCardUrl { get; set; }
    public EnquiryStatus Status { get; set; } = EnquiryStatus.Draft;
    public DateTimeOffset? FollowUpDate { get; set; }
    public Guid? ConvertedParentId { get; set; }
    public Guid? ConvertedChildId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public required string CreatedBy { get; set; }
}
