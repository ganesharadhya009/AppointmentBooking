using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateTherapyTypeRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    public string? PhotoUrl { get; set; }

    public List<Guid> BranchIds { get; set; } = [];
}

public class UpdateTherapyTypeRequest : CreateTherapyTypeRequest
{
    [Required]
    public TherapyTypeStatus Status { get; set; }
}

public class TherapyTypeResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? PhotoUrl { get; set; }
    public TherapyTypeStatus Status { get; set; }
    public List<Guid> BranchIds { get; set; } = [];
}
