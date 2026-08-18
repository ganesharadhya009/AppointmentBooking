namespace DirectoryApi.Entities;

public class Holiday
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public DateOnly Date { get; set; }
    public required string Reason { get; set; }
}
