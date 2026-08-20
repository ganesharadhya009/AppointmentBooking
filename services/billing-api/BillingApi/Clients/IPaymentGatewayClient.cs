using BillingApi.Entities;

namespace BillingApi.Clients;

public class GatewayCheckoutSession
{
    public required string MerchantReference { get; set; }
    public required string CheckoutUrl { get; set; }
}

public interface IPaymentGatewayClient
{
    Task<GatewayCheckoutSession> InitiateCheckoutAsync(Guid transactionId, decimal amount, PaymentRail rail, CancellationToken cancellationToken = default);
}
