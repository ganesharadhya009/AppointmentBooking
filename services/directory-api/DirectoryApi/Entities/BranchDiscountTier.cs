namespace DirectoryApi.Entities;

public class BranchDiscountTier
{
    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public int SessionCount { get; set; }
    public decimal DiscountPerSession { get; set; }
}
