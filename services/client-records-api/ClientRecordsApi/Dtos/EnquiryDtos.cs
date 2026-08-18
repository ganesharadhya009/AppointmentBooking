using System.ComponentModel.DataAnnotations;
using ClientRecordsApi.Entities;

namespace ClientRecordsApi.Dtos;

public class CreateEnquiryRequest
{
    [Required, MaxLength(200)]
    public required string ParentName { get; set; }

    [Required, MaxLength(20)]
    public required string ParentMobileNumber { get; set; }

    [MaxLength(200)]
    public string? ParentEmail { get; set; }

    [Required, MaxLength(200)]
    public required string ChildName { get; set; }

    public DateOnly? ChildDateOfBirth { get; set; }

    [MaxLength(20)]
    public string? ChildGender { get; set; }

    [MaxLength(200)]
    public string? PreferredTherapy { get; set; }

    [MaxLength(200)]
    public string? PreferredLocation { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }

    [MaxLength(6)]
    public List<string> Concerns { get; set; } = [];

    public string? DiagnosisReportUrl { get; set; }
    public string? ParentIdCardUrl { get; set; }
    public EnquiryStatus? Status { get; set; }
    public DateTimeOffset? FollowUpDate { get; set; }
}

public class UpdateEnquiryRequest : CreateEnquiryRequest
{
}

public class EnquiryResponse
{
    public Guid Id { get; set; }
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
    public EnquiryStatus Status { get; set; }
    public DateTimeOffset? FollowUpDate { get; set; }
    public Guid? ConvertedParentId { get; set; }
    public Guid? ConvertedChildId { get; set; }
}
