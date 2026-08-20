using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateAppVersionRequest
{
    [Required]
    public TargetApp? TargetApp { get; set; }

    [Required, MaxLength(50)]
    public required string VersionNumber { get; set; }

    [Required]
    public ReleaseStatus? ReleaseStatus { get; set; }

    public bool RequireUpdate { get; set; }

    [Required]
    public DateOnly? ReleaseDate { get; set; }
}

public class UpdateAppVersionRequest : CreateAppVersionRequest
{
}

public class AppVersionResponse
{
    public Guid Id { get; set; }
    public TargetApp TargetApp { get; set; }
    public required string VersionNumber { get; set; }
    public ReleaseStatus ReleaseStatus { get; set; }
    public bool RequireUpdate { get; set; }
    public DateOnly ReleaseDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
