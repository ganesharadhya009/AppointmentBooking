using SchedulingApi.Clients;

namespace SchedulingApi.Tests.Fakes;

public class FakeBillingApiClient : IBillingApiClient
{
    public bool CreditResult { get; set; } = true;

    public Task<bool> CreditWalletAsync(Guid parentId, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(CreditResult);
}
