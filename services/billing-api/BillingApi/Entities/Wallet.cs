namespace BillingApi.Entities;

public class Wallet
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ParentId { get; set; }
    public decimal Balance { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public enum WalletTransactionType
{
    Credit,
    Debit
}

public class WalletTransaction
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid WalletId { get; set; }
    public WalletTransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public Guid? RelatedAppointmentId { get; set; }
    public required string Reason { get; set; }
    public required string IdempotencyKey { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
