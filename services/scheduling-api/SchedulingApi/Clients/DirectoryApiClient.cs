using System.Net.Http.Json;
using System.Text.Json;

namespace SchedulingApi.Clients;

public class DirectoryApiClient(HttpClient httpClient) : IDirectoryApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<BranchInfo?> GetBranchAsync(Guid branchId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/branches/{branchId}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<BranchInfo>(JsonOptions, cancellationToken)
            : null;
    }

    public async Task<TherapistInfo?> GetTherapistAsync(Guid therapistId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/therapists/{therapistId}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<TherapistInfo>(JsonOptions, cancellationToken)
            : null;
    }

    public async Task<bool?> IsBranchClosedAsync(Guid branchId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/holidays/is-closed?branchId={branchId}&date={date:yyyy-MM-dd}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return null;
        }
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }
        var result = await response.Content.ReadFromJsonAsync<IsClosedResponse>(JsonOptions, cancellationToken);
        return result?.IsClosed;
    }

    public async Task<ConsultantDoctorInfo?> GetConsultantDoctorAsync(Guid consultantDoctorId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/consultant-doctors/{consultantDoctorId}");
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode
            ? await response.Content.ReadFromJsonAsync<ConsultantDoctorInfo>(JsonOptions, cancellationToken)
            : null;
    }
}
