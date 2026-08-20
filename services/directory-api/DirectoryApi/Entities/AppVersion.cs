namespace DirectoryApi.Entities;

public enum TargetApp
{
    AdminSpa,
    ParentApp,
    StaffApp
}

public enum ReleaseStatus
{
    Draft,
    Published,
    Deprecated
}

// Platform-scoped, deliberately -- no TenantId. One Admin SPA / one set of mobile app binaries
// serves every tenant, so a version record duplicated per tenant would be meaningless. Modeled
// exactly like the existing Tenant entity (see design spec §1).
public class AppVersion
{
    public Guid Id { get; set; }
    public TargetApp TargetApp { get; set; }
    public required string VersionNumber { get; set; }
    public ReleaseStatus ReleaseStatus { get; set; }
    public bool RequireUpdate { get; set; }
    public DateOnly ReleaseDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
