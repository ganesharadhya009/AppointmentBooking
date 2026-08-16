namespace ClientRecordsApi.Tenancy;

public interface ITenantContext
{
    Guid TenantId { get; }
}
