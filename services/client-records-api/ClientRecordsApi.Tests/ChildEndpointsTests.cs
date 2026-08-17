using System.Net;
using System.Net.Http.Json;
using ClientRecordsApi.Common;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tests.Fixtures;
using Xunit;

namespace ClientRecordsApi.Tests;

public class ChildEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ChildEndpointsTests(LocalDbTestFixture fixture)
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

    private async Task<Guid> CreateParentAsync(Guid tenantId)
    {
        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/parents", tenantId, new CreateParentRequest
        {
            Name = "Test Parent For Child",
            MobileNumber = "9876543210",
            Email = $"{Guid.NewGuid():N}@example.com"
        }));
        var body = await response.Content.ReadFromJsonAsync<ParentResponse>();
        return body!.Id;
    }

    [Fact]
    public async Task PostThenGetChild_RoundTripsCorrectly()
    {
        var tenantId = Guid.NewGuid();
        var parentId = await CreateParentAsync(tenantId);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantId, new CreateChildRequest
        {
            ParentId = parentId,
            Name = "Test Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var createdBody = await created.Content.ReadFromJsonAsync<ChildResponse>();

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/children/{createdBody!.Id}", tenantId));

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<ChildResponse>();
        Assert.Equal("Test Child", fetchedBody!.Name);
        Assert.Equal(parentId, fetchedBody.ParentId);
    }

    [Fact]
    public async Task PostChild_WithCrossTenantParent_ReturnsValidationProblem()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var parentIdOfTenantB = await CreateParentAsync(tenantB);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantA, new CreateChildRequest
        {
            ParentId = parentIdOfTenantB,
            Name = "Cross Tenant Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostChild_WithUnknownParentId_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantId, new CreateChildRequest
        {
            ParentId = Guid.NewGuid(),
            Name = "Orphan Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteChild_SetsInactive_RowStaysListed()
    {
        var tenantId = Guid.NewGuid();
        var parentId = await CreateParentAsync(tenantId);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantId, new CreateChildRequest
        {
            ParentId = parentId,
            Name = "To Deactivate",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ChildResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/children/{createdBody!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/children/{createdBody.Id}", tenantId));
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<ChildResponse>();

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        Assert.Equal(ClientStatus.Inactive, fetchedBody!.Status);
    }

    [Fact]
    public async Task GetChildById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var parentId = await CreateParentAsync(tenantA);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantA, new CreateChildRequest
        {
            ParentId = parentId,
            Name = "Tenant A Only Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ChildResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/children/{createdBody!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListChildren_NeverReturnsAnotherTenantsChildren()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var parentIdA = await CreateParentAsync(tenantA);
        var parentIdB = await CreateParentAsync(tenantB);

        await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantA, new CreateChildRequest
        {
            ParentId = parentIdA,
            Name = "Tenant A Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantB, new CreateChildRequest
        {
            ParentId = parentIdB,
            Name = "Tenant B Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/children", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ChildResponse>>();

        Assert.All(body!.Items, c => Assert.NotEqual("Tenant B Child", c.Name));
        Assert.Contains(body.Items, c => c.Name == "Tenant A Child");
    }

    [Fact]
    public async Task PutChild_UpdatesFieldsCorrectly()
    {
        var tenantId = Guid.NewGuid();
        var parentId = await CreateParentAsync(tenantId);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantId, new CreateChildRequest
        {
            ParentId = parentId,
            Name = "Original Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ChildResponse>();

        var updateResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/children/{createdBody!.Id}", tenantId, new UpdateChildRequest
        {
            ParentId = parentId,
            Name = "Updated Child",
            DateOfBirth = new DateOnly(2019, 6, 15),
            Status = ClientStatus.Active
        }));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updatedBody = await updateResponse.Content.ReadFromJsonAsync<ChildResponse>();
        Assert.Equal("Updated Child", updatedBody!.Name);
    }

    [Fact]
    public async Task PutChild_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var parentIdA = await CreateParentAsync(tenantA);
        // A parent that exists under tenantB so the request's own ParentId-exists
        // check passes, isolating the assertion to the child-lookup tenant filter.
        var parentIdB = await CreateParentAsync(tenantB);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/children", tenantA, new CreateChildRequest
        {
            ParentId = parentIdA,
            Name = "Tenant A Child",
            DateOfBirth = new DateOnly(2019, 6, 15)
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<ChildResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/children/{createdBody!.Id}", tenantB, new UpdateChildRequest
        {
            ParentId = parentIdB,
            Name = "Hijacked Child",
            DateOfBirth = new DateOnly(2019, 6, 15),
            Status = ClientStatus.Active
        }));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
