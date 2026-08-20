namespace DirectoryApi.Entities;

public enum SubscriptionRecordStatus
{
    Active,
    PastDue,
    Cancelled
}

public enum BillingCycle
{
    Monthly,
    Annual
}

// Platform-provisioned, same trust boundary as TenantEndpoints.cs -- not a public self-serve
// signup surface. See design spec §2 for why: an unauthenticated public signup form creating
// billing-relevant records is exactly the abuse vector the platform's deferred-auth decision
// already rules out elsewhere.
public class TenantSubscription
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string PlanName { get; set; }
    public SubscriptionRecordStatus Status { get; set; }
    public BillingCycle BillingCycle { get; set; }
    public DateOnly NextBillingDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
