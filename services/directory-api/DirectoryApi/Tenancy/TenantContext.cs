namespace DirectoryApi.Tenancy;

public class TenantContext : ITenantContext
{
    private Guid? _tenantId;

    public Guid TenantId => _tenantId ?? throw new InvalidOperationException(
        "TenantId was read before it was set. This should only happen for a request the tenant middleware didn't scope (e.g. /health or /tenants) — those endpoints must not depend on ITenantContext.");

    public void Set(Guid tenantId)
    {
        _tenantId = tenantId;
    }
}
