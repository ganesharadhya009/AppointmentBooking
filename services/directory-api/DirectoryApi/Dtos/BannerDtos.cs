using System.ComponentModel.DataAnnotations;

namespace DirectoryApi.Dtos;

public class CreateBannerRequest
{
    [Required, MaxLength(2000)]
    public required string ImageUrl { get; set; }

    [Required, MaxLength(200)]
    public required string WatermarkTitle { get; set; }
}

public class UpdateBannerRequest : CreateBannerRequest
{
}

public class BannerResponse
{
    public Guid Id { get; set; }
    public required string ImageUrl { get; set; }
    public required string WatermarkTitle { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
