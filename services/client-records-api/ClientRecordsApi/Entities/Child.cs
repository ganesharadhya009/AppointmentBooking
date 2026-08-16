namespace ClientRecordsApi.Entities;

public class Child
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ParentId { get; set; }
    public required string Name { get; set; }
    public DateOnly DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? GuardianName { get; set; }
    public ClientStatus Status { get; set; } = ClientStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public required string CreatedBy { get; set; }
}
