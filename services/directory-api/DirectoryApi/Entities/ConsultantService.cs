namespace DirectoryApi.Entities;

public enum ConsultantStatus
{
    Active,
    Inactive
}

public class ConsultantService
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public string? PhotoUrl { get; set; }
    public ConsultantStatus Status { get; set; } = ConsultantStatus.Active;
}
