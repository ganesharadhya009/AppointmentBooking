using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class ConsultantServiceEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ConsultantServiceEndpointsTests(LocalDbTestFixture fixture)
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
    public async Task PostConsultantService_ThenGetById_ReturnsCreatedService()
    {
        var tenantId = Guid.NewGuid();

        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantId, new CreateConsultantServiceRequest
        {
            Name = "Paediatry"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(ConsultantStatus.Active, created!.Status);

        var getResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-services/{created.Id}", tenantId));
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
    }

    [Fact]
    public async Task GetConsultantServiceById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantA, new CreateConsultantServiceRequest
        {
            Name = "ENT"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-services/{created!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteConsultantService_SetsStatusToInactive()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantId, new CreateConsultantServiceRequest
        {
            Name = "Psychiatric Consultation"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/consultant-services/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-services/{created.Id}", tenantId));
        var body = await getResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();
        Assert.Equal(ConsultantStatus.Inactive, body!.Status);
    }

    [Fact]
    public async Task GetConsultantServices_FilteredByStatus_ExcludesInactive()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantId, new CreateConsultantServiceRequest
        {
            Name = "To Deactivate"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/consultant-services/{created!.Id}", tenantId));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/consultant-services?status=Active", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ConsultantServiceResponse>>();

        Assert.DoesNotContain(body!.Items, s => s.Id == created.Id);
    }
}
