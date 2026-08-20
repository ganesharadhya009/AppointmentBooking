using BillingApi.Entities;

namespace BillingApi.Clients;

// The only implementation of IPaymentGatewayClient for now -- a real provider (Razorpay, Stripe,
// CCAvenue, etc.) is a future swap-in via DI (see Program.cs), not part of this sub-project. See
// docs/superpowers/specs/2026-08-20-billing-api-payment-gateway-design.md §5. Entirely in-process,
// no real HTTP call anywhere, no external dependency, no API keys.
public class StubPaymentGatewayClient : IPaymentGatewayClient
{
    public Task<GatewayCheckoutSession> InitiateCheckoutAsync(Guid transactionId, decimal amount, PaymentRail rail, CancellationToken cancellationToken = default)
    {
        var merchantReference = $"STUB-{Guid.NewGuid():N}";
        return Task.FromResult(new GatewayCheckoutSession
        {
            MerchantReference = merchantReference,
            CheckoutUrl = $"https://stub-gateway.local/checkout/{merchantReference}"
        });
    }
}
