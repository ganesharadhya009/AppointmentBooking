using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class BranchEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public BranchEndpointsTests(LocalDbTestFixture fixture)
    {
        _client = fixture.CreateClient();
    }

    private static List<DiscountTierDto> ValidTiers() =>
    [
        new() { SessionCount = 10, DiscountPerSession = 50 },
        new() { SessionCount = 24, DiscountPerSession = 100 },
        new() { SessionCount = 48, DiscountPerSession = 150 },
        new() { SessionCount = 72, DiscountPerSession = 200 },
        new() { SessionCount = 96, DiscountPerSession = 250 }
    ];

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
    public async Task PostBranches_WithoutTenantHeader_Returns400ProblemDetails()
    {
        var response = await _client.PostAsJsonAsync("/branches", new CreateBranchRequest
        {
            Name = "No Header Branch",
            WeeklyDayOff = DayOfWeek.Sunday,
            DiscountTiers = ValidTiers()
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task PostBranches_WithInvalidDiscountTiers_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var badTiers = ValidTiers();
        badTiers.RemoveAt(0);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/branches", tenantId, new CreateBranchRequest
        {
            Name = "Bad Tiers Branch",
            WeeklyDayOff = DayOfWeek.Sunday,
            DiscountTiers = badTiers
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostThenGetBranch_RoundTripsCorrectly()
    {
        var tenantId = Guid.NewGuid();

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/branches", tenantId, new CreateBranchRequest
        {
            Name = "Banashankari",
            City = "Bengaluru",
            WeeklyDayOff = DayOfWeek.Sunday,
            DiscountTiers = ValidTiers()
        }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var createdBody = await created.Content.ReadFromJsonAsync<BranchResponse>();

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/branches/{createdBody!.Id}", tenantId));

        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<BranchResponse>();
        Assert.Equal("Banashankari", fetchedBody!.Name);
        Assert.Equal(5, fetchedBody.DiscountTiers.Count);
    }

    [Fact]
    public async Task ListBranches_NeverReturnsAnotherTenantsBranches()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        await _client.SendAsync(WithTenant(HttpMethod.Post, "/branches", tenantA, new CreateBranchRequest
        {
            Name = "Tenant A Branch",
            WeeklyDayOff = DayOfWeek.Sunday,
            DiscountTiers = ValidTiers()
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/branches", tenantB, new CreateBranchRequest
        {
            Name = "Tenant B Branch",
            WeeklyDayOff = DayOfWeek.Sunday,
            DiscountTiers = ValidTiers()
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/branches", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<BranchResponse>>();

        Assert.All(body!.Items, b => Assert.NotEqual("Tenant B Branch", b.Name));
        Assert.Contains(body.Items, b => b.Name == "Tenant A Branch");
    }
}
