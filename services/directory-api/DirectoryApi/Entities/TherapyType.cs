namespace DirectoryApi.Entities;

public enum TherapyTypeStatus
{
    Active,
    Inactive,
    Deleted
}

public class TherapyType
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public string? PhotoUrl { get; set; }
    public TherapyTypeStatus Status { get; set; } = TherapyTypeStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public required string CreatedBy { get; set; }

    public List<Branch> Branches { get; set; } = [];
}
