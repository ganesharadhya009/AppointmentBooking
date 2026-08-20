using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreatePosterRequest
{
    [Required, MaxLength(100)]
    public required string Type { get; set; }

    [Required]
    public PosterPosition? Position { get; set; }

    [Required]
    public DateOnly? ActiveFrom { get; set; }

    [Required]
    public DateOnly? ActiveTo { get; set; }

    public int Priority { get; set; }

    public bool IsActive { get; set; }
}

public class UpdatePosterRequest : CreatePosterRequest
{
}

public class PosterResponse
{
    public Guid Id { get; set; }
    public required string Type { get; set; }
    public PosterPosition Position { get; set; }
    public DateOnly ActiveFrom { get; set; }
    public DateOnly ActiveTo { get; set; }
    public int Priority { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
