using System.Net.Http.Json;

namespace SchedulingApi.Clients;

public class BillingApiClient(HttpClient httpClient) : IBillingApiClient
{
    public async Task<bool> CreditWalletAsync(Guid parentId, decimal amount, string reason, Guid? relatedAppointmentId, string idempotencyKey, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/wallets/{parentId}/credit");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        request.Headers.Add("Idempotency-Key", idempotencyKey);
        request.Content = JsonContent.Create(new { amount, reason, relatedAppointmentId });

        try
        {
            var response = await httpClient.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException)
        {
            return false;
        }
    }
}
