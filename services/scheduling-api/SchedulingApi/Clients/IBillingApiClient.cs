namespace SchedulingApi.Clients;

public interface IBillingApiClient
{
    Task<bool> CreditWalletAsync(Guid parentId, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey, Guid tenantId, CancellationToken cancellationToken = default);
}
