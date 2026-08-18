using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateConsultantClinicRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }

    [MaxLength(200)]
    public string? LeadContactName { get; set; }

    [MaxLength(20)]
    public string? LeadContactPhone { get; set; }
}

public class UpdateConsultantClinicRequest : CreateConsultantClinicRequest
{
    [Required]
    public ConsultantStatus? Status { get; set; }
}

public class ConsultantClinicResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? LeadContactName { get; set; }
    public string? LeadContactPhone { get; set; }
    public ConsultantStatus Status { get; set; }
}
