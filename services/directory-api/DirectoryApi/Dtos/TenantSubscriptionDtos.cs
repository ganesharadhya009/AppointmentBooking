using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateTenantSubscriptionRequest
{
    [Required]
    public Guid TenantId { get; set; }

    [Required, MaxLength(100)]
    public required string PlanName { get; set; }

    [Required]
    public SubscriptionRecordStatus? Status { get; set; }

    [Required]
    public BillingCycle? BillingCycle { get; set; }

    [Required]
    public DateOnly? NextBillingDate { get; set; }
}

public class UpdateTenantSubscriptionRequest
{
    [Required, MaxLength(100)]
    public required string PlanName { get; set; }

    [Required]
    public SubscriptionRecordStatus? Status { get; set; }

    [Required]
    public BillingCycle? BillingCycle { get; set; }

    [Required]
    public DateOnly? NextBillingDate { get; set; }
}

public class TenantSubscriptionResponse
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string PlanName { get; set; }
    public SubscriptionRecordStatus Status { get; set; }
    public BillingCycle BillingCycle { get; set; }
    public DateOnly NextBillingDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
