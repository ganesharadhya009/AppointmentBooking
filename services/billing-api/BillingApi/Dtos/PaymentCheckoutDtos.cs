using System.ComponentModel.DataAnnotations;
using BillingApi.Entities;

namespace BillingApi.Dtos;

public class CreatePaymentCheckoutRequest
{
    [Required]
    public Guid ParentId { get; set; }

    [Required]
    [Range(typeof(decimal), "0.01", "99999999.99")]
    public decimal? Amount { get; set; }

    [Required]
    public PaymentRail? Rail { get; set; }
}

public class PaymentCheckoutCallbackRequest
{
    [Required]
    public PaymentGatewayTransactionStatus? Status { get; set; }

    public string? RawPayload { get; set; }
}

public class PaymentCheckoutResponse
{
    public Guid Id { get; set; }
    public Guid ParentId { get; set; }
    public decimal Amount { get; set; }
    public PaymentRail Rail { get; set; }
    public PaymentGatewayTransactionStatus Status { get; set; }
    public required string MerchantReference { get; set; }
    public string? CheckoutUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
