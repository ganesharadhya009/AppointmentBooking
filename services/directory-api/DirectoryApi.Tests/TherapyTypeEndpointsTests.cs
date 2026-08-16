using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class TherapyTypeEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public TherapyTypeEndpointsTests(LocalDbTestFixture fixture)
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

    private async Task<Guid> CreateBranchAsync(Guid tenantId)
    {
        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/branches", tenantId, new CreateBranchRequest
        {
            Name = "Test Branch",
            WeeklyDayOff = DayOfWeek.Sunday,
            DiscountTiers =
            [
                new() { SessionCount = 10, DiscountPerSession = 50 },
                new() { SessionCount = 24, DiscountPerSession = 100 },
                new() { SessionCount = 48, DiscountPerSession = 150 },
                new() { SessionCount = 72, DiscountPerSession = 200 },
                new() { SessionCount = 96, DiscountPerSession = 250 }
            ]
        }));
        var body = await response.Content.ReadFromJsonAsync<BranchResponse>();
        return body!.Id;
    }

    [Fact]
    public async Task PostThenGetTherapyType_RoundTripsWithBranchAssociation()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapy-types", tenantId, new CreateTherapyTypeRequest
        {
            Name = "Occupational Therapy",
            BranchIds = [branchId]
        }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var createdBody = await created.Content.ReadFromJsonAsync<TherapyTypeResponse>();

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/therapy-types/{createdBody!.Id}", tenantId));
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<TherapyTypeResponse>();

        Assert.Equal("Occupational Therapy", fetchedBody!.Name);
        Assert.Equal(TherapyTypeStatus.Active, fetchedBody.Status);
        Assert.Contains(branchId, fetchedBody.BranchIds);
    }

    [Fact]
    public async Task DeleteTherapyType_SoftDeletes_RowStaysListed()
    {
        var tenantId = Guid.NewGuid();

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapy-types", tenantId, new CreateTherapyTypeRequest
        {
            Name = "Physiotherapy"
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<TherapyTypeResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/therapy-types/{createdBody!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/therapy-types/{createdBody.Id}", tenantId));
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<TherapyTypeResponse>();

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        Assert.Equal(TherapyTypeStatus.Deleted, fetchedBody!.Status);
    }

    [Fact]
    public async Task PutTherapyType_CannotReactivateADeletedOne()
    {
        var tenantId = Guid.NewGuid();

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapy-types", tenantId, new CreateTherapyTypeRequest
        {
            Name = "ABA Therapy"
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<TherapyTypeResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/therapy-types/{createdBody!.Id}", tenantId));

        var reactivateResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/therapy-types/{createdBody.Id}", tenantId, new UpdateTherapyTypeRequest
        {
            Name = "ABA Therapy",
            Status = TherapyTypeStatus.Active
        }));

        Assert.Equal(HttpStatusCode.BadRequest, reactivateResponse.StatusCode);
    }

    [Fact]
    public async Task ListTherapyTypes_NeverReturnsAnotherTenantsRows()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapy-types", tenantA, new CreateTherapyTypeRequest { Name = "Tenant A Therapy" }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapy-types", tenantB, new CreateTherapyTypeRequest { Name = "Tenant B Therapy" }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/therapy-types", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<TherapyTypeResponse>>();

        Assert.All(body!.Items, t => Assert.NotEqual("Tenant B Therapy", t.Name));
        Assert.Contains(body.Items, t => t.Name == "Tenant A Therapy");
    }
}
