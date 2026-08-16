using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateTenantRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }
}

public class TenantResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public SubscriptionStatus SubscriptionStatus { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
