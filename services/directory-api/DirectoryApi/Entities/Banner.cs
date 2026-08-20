namespace DirectoryApi.Entities;

public class Banner
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string ImageUrl { get; set; }
    public required string WatermarkTitle { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
