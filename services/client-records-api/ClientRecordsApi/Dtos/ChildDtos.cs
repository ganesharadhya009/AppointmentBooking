using System.ComponentModel.DataAnnotations;
using ClientRecordsApi.Entities;

namespace ClientRecordsApi.Dtos;

public class CreateChildRequest
{
    [Required]
    public Guid ParentId { get; set; }

    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required]
    public DateOnly? DateOfBirth { get; set; }

    [MaxLength(20)]
    public string? Gender { get; set; }

    [MaxLength(200)]
    public string? GuardianName { get; set; }
}

public class UpdateChildRequest : CreateChildRequest
{
    [Required]
    public ClientStatus? Status { get; set; }
}

public class ChildResponse
{
    public Guid Id { get; set; }
    public Guid ParentId { get; set; }
    public required string Name { get; set; }
    public DateOnly DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? GuardianName { get; set; }
    public ClientStatus Status { get; set; }
}
