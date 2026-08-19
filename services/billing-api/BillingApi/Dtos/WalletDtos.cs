using System.ComponentModel.DataAnnotations;
using BillingApi.Entities;

namespace BillingApi.Dtos;

public class CreditWalletRequest
{
    [Required]
    public decimal? Amount { get; set; }

    [Required, MaxLength(500)]
    public required string Reason { get; set; }

    public Guid? RelatedAppointmentId { get; set; }
}

public class DebitWalletRequest
{
    [Required]
    public decimal? Amount { get; set; }

    [Required, MaxLength(500)]
    public required string Reason { get; set; }

    public Guid? RelatedAppointmentId { get; set; }
}

public class WalletResponse
{
    public Guid Id { get; set; }
    public Guid ParentId { get; set; }
    public decimal Balance { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class WalletTransactionResponse
{
    public Guid Id { get; set; }
    public Guid WalletId { get; set; }
    public WalletTransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public Guid? RelatedAppointmentId { get; set; }
    public required string Reason { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
