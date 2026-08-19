namespace BillingApi.Tenancy;

public interface ITenantContext
{
    Guid TenantId { get; }
}
