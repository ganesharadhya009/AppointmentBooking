using System.Net;
using System.Net.Http.Json;
using ClientRecordsApi.Common;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tests.Fixtures;
using Xunit;

namespace ClientRecordsApi.Tests;

public class ParentEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ParentEndpointsTests(LocalDbTestFixture fixture)
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
    public async Task PostThenGetParent_RoundTripsCorrectly()
    {
        var tenantId = Guid.NewGuid();

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantId, new CreateParentRequest
        {
            Name = "Jane Doe",
            MobileNumber = "9876543210",
            Email = "jane@example.com",
            City = "Bengaluru"
        }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var createdBody = await created.Content.ReadFromJsonAsync<ParentResponse>();

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/parents/{createdBody!.Id}", tenantId));

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<ParentResponse>();
        Assert.Equal("Jane Doe", fetchedBody!.Name);
        Assert.Equal(ClientStatus.Active, fetchedBody.Status);
    }

    [Fact]
    public async Task PostParent_WithoutTenantHeader_Returns400ProblemDetails()
    {
        var response = await _client.PostAsJsonAsync("/parents", new CreateParentRequest
        {
            Name = "No Header Parent",
            MobileNumber = "9876543210",
            Email = "noheader@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task PostParent_WithMissingRequiredField_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantId, new { Name = "Incomplete" }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteParent_SetsInactive_RowStaysListed()
    {
        var tenantId = Guid.NewGuid();

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantId, new CreateParentRequest
        {
            Name = "To Deactivate",
            MobileNumber = "9876543210",
            Email = "deactivate@example.com"
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ParentResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/parents/{createdBody!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/parents/{createdBody.Id}", tenantId));
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<ParentResponse>();

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        Assert.Equal(ClientStatus.Inactive, fetchedBody!.Status);
    }

    [Fact]
    public async Task GetParentById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantA, new CreateParentRequest
        {
            Name = "Tenant A Only Parent",
            MobileNumber = "9876543210",
            Email = "tenanta@example.com"
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ParentResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/parents/{createdBody!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListParents_NeverReturnsAnotherTenantsParents()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantA, new CreateParentRequest
        {
            Name = "Tenant A Parent",
            MobileNumber = "9876543210",
            Email = "a@example.com"
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantB, new CreateParentRequest
        {
            Name = "Tenant B Parent",
            MobileNumber = "9876543210",
            Email = "b@example.com"
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/parents", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ParentResponse>>();

        Assert.All(body!.Items, p => Assert.NotEqual("Tenant B Parent", p.Name));
        Assert.Contains(body.Items, p => p.Name == "Tenant A Parent");
    }
}
