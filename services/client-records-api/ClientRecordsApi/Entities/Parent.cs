namespace ClientRecordsApi.Entities;

public enum ClientStatus
{
    Active,
    Inactive
}

public class Parent
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public required string MobileNumber { get; set; }
    public required string Email { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public ClientStatus Status { get; set; } = ClientStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public required string CreatedBy { get; set; }
}
