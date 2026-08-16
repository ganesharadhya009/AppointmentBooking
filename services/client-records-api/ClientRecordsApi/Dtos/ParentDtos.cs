using System.ComponentModel.DataAnnotations;
using ClientRecordsApi.Entities;

namespace ClientRecordsApi.Dtos;

public class CreateParentRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required, MaxLength(20)]
    public required string MobileNumber { get; set; }

    [Required, MaxLength(200)]
    public required string Email { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }
}

public class UpdateParentRequest : CreateParentRequest
{
    [Required]
    public ClientStatus Status { get; set; }
}

public class ParentResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string MobileNumber { get; set; }
    public required string Email { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public ClientStatus Status { get; set; }
}
