namespace DirectoryApi.Entities;

public enum StaffRole
{
    SuperAdmin,
    Admin,
    Auditor,
    HR
}

// Credential-free directory stub -- Email is a contact field, not a login identifier. No
// password/credential of any kind exists on this entity. Role is a label, not an authorization
// mechanism -- nothing on the platform checks it to gate anything yet. See design spec §3.
public class StaffMember
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string? Phone { get; set; }
    public StaffRole Role { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
