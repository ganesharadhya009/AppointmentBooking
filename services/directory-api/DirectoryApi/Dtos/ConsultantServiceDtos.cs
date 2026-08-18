using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateConsultantServiceRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    public string? PhotoUrl { get; set; }
}

public class UpdateConsultantServiceRequest : CreateConsultantServiceRequest
{
    [Required]
    public ConsultantStatus? Status { get; set; }
}

public class ConsultantServiceResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? PhotoUrl { get; set; }
    public ConsultantStatus Status { get; set; }
}
