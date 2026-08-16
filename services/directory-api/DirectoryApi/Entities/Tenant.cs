namespace DirectoryApi.Entities;

public enum SubscriptionStatus
{
    Trial,
    Active,
    Suspended,
    Cancelled
}

public class Tenant
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public SubscriptionStatus SubscriptionStatus { get; set; } = SubscriptionStatus.Trial;
    public DateTimeOffset CreatedAt { get; set; }
}
