using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Dtos;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class TenantEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public TenantEndpointsTests(LocalDbTestFixture fixture)
    {
        _client = fixture.CreateClient();
    }

    [Fact]
    public async Task PostTenants_CreatesTenant_WithTrialStatusByDefault()
    {
        var response = await _client.PostAsJsonAsync("/tenants", new CreateTenantRequest { Name = "Acme Clinics" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TenantResponse>();
        Assert.Equal("Acme Clinics", body!.Name);
        Assert.Equal(DirectoryApi.Entities.SubscriptionStatus.Trial, body.SubscriptionStatus);
    }

    [Fact]
    public async Task GetTenantById_ReturnsTheCreatedTenant()
    {
        var created = await _client.PostAsJsonAsync("/tenants", new CreateTenantRequest { Name = "Beta Clinics" });
        var createdBody = await created.Content.ReadFromJsonAsync<TenantResponse>();

        var response = await _client.GetAsync($"/tenants/{createdBody!.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TenantResponse>();
        Assert.Equal("Beta Clinics", body!.Name);
    }

    [Fact]
    public async Task GetTenantById_ReturnsProblemDetails_WhenNotFound()
    {
        var response = await _client.GetAsync($"/tenants/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task TenantEndpoints_DoNotRequire_XTenantIdHeader()
    {
        var response = await _client.PostAsJsonAsync("/tenants", new CreateTenantRequest { Name = "No Header Clinics" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
