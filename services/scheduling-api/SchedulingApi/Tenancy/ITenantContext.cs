namespace SchedulingApi.Tenancy;

public interface ITenantContext
{
    Guid TenantId { get; }
}
