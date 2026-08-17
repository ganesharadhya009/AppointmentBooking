using System.Net.Http.Json;
using System.Text.Json;

namespace SchedulingApi.Clients;

public class ClientRecordsApiClient(HttpClient httpClient) : IClientRecordsApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<ChildInfo?> GetChildAsync(Guid childId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/children/{childId}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<ChildInfo>(JsonOptions, cancellationToken)
            : null;
    }
}
