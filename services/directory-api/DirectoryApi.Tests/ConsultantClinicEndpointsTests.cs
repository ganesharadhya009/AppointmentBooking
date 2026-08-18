using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class ConsultantClinicEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ConsultantClinicEndpointsTests(LocalDbTestFixture fixture)
    {
        _client = fixture.CreateClient();
    }

    private HttpRequestMessage WithTenant(HttpMethod method, string url, Guid tenantId, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return request;
    }

    [Fact]
    public async Task PostConsultantClinic_ThenGetById_ReturnsCreatedClinic()
    {
        var tenantId = Guid.NewGuid();

        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "City Hospital",
            City = "Bengaluru",
            State = "Karnataka"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(ConsultantStatus.Active, created!.Status);
    }

    [Fact]
    public async Task GetConsultantClinics_FilteredByCityAndState_ReturnsOnlyMatching()
    {
        var tenantId = Guid.NewGuid();
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "Matching Clinic",
            City = "Bengaluru",
            State = "Karnataka"
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "Non-Matching Clinic",
            City = "Chennai",
            State = "Tamil Nadu"
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/consultant-clinics?city=Bengaluru&state=Karnataka", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ConsultantClinicResponse>>();

        Assert.Single(body!.Items);
        Assert.Equal("Matching Clinic", body.Items[0].Name);
    }

    [Fact]
    public async Task DeleteConsultantClinic_SetsStatusToInactive()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "Test Clinic"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/consultant-clinics/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-clinics/{created.Id}", tenantId));
        var body = await getResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();
        Assert.Equal(ConsultantStatus.Inactive, body!.Status);
    }

    [Fact]
    public async Task GetConsultantClinicById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantA, new CreateConsultantClinicRequest
        {
            Name = "Tenant A Clinic"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-clinics/{created!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
