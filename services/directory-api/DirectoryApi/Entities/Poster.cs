namespace DirectoryApi.Entities;

public enum PosterPosition
{
    Top,
    Bottom,
    Popup
}

public class Poster
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Type { get; set; }
    public PosterPosition Position { get; set; }
    public DateOnly ActiveFrom { get; set; }
    public DateOnly ActiveTo { get; set; }
    public int Priority { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
