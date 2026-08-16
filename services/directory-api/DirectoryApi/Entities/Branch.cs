namespace DirectoryApi.Entities;

public class Branch
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public string? Address { get; set; }
    public string? Country { get; set; }
    public string? State { get; set; }
    public string? City { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DayOfWeek WeeklyDayOff { get; set; }
    public string? PhotoUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public required string CreatedBy { get; set; }

    public List<BranchDiscountTier> DiscountTiers { get; set; } = [];
    public List<TherapyType> TherapyTypes { get; set; } = [];
}
