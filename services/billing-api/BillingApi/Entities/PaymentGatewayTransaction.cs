namespace BillingApi.Entities;

public enum PaymentRail
{
    Card,
    Netbanking,
    Wallet,
    Upi,
    NeftRtgs
}

public enum PaymentGatewayTransactionStatus
{
    Initiated,
    Success,
    Failed
}

public class PaymentGatewayTransaction
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ParentId { get; set; }
    public decimal Amount { get; set; }
    public PaymentRail Rail { get; set; }
    public PaymentGatewayTransactionStatus Status { get; set; } = PaymentGatewayTransactionStatus.Initiated;
    public required string MerchantReference { get; set; }
    public string? RawGatewayPayload { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
