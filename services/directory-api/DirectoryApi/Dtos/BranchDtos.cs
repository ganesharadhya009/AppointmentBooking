using System.ComponentModel.DataAnnotations;

namespace DirectoryApi.Dtos;

public class DiscountTierDto
{
    [Range(1, int.MaxValue)]
    public int SessionCount { get; set; }

    [Range(0, double.MaxValue)]
    public decimal DiscountPerSession { get; set; }
}

public class CreateBranchRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public DayOfWeek WeeklyDayOff { get; set; }

    public string? PhotoUrl { get; set; }

    [Required]
    public required List<DiscountTierDto> DiscountTiers { get; set; }
}

public class UpdateBranchRequest : CreateBranchRequest
{
    public bool IsActive { get; set; }
}

public class BranchResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Address { get; set; }
    public string? Country { get; set; }
    public string? State { get; set; }
    public string? City { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DayOfWeek WeeklyDayOff { get; set; }
    public string? PhotoUrl { get; set; }
    public bool IsActive { get; set; }
    public required List<DiscountTierDto> DiscountTiers { get; set; }
}
