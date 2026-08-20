using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateStaffMemberRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required, MaxLength(320), EmailAddress]
    public required string Email { get; set; }

    [MaxLength(50)]
    public string? Phone { get; set; }

    [Required]
    public StaffRole? Role { get; set; }
}

public class UpdateStaffMemberRequest : CreateStaffMemberRequest
{
    [Required]
    public bool? IsActive { get; set; }
}

public class StaffMemberResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string? Phone { get; set; }
    public StaffRole Role { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
