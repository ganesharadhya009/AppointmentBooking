namespace DirectoryApi.Tenancy;

public interface ITenantContext
{
    Guid TenantId { get; }
}
