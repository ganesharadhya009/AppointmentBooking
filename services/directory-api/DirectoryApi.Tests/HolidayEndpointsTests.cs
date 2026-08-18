using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class HolidayEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public HolidayEndpointsTests(LocalDbTestFixture fixture)
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
            Name = "Test Branch For Holiday",
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
        var branch = await response.Content.ReadFromJsonAsync<BranchResponse>();
        return branch!.Id;
    }

    [Fact]
    public async Task PostHoliday_ThenGetIsClosed_ReturnsTrue()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);

        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 10, 2),
            Reason = "Gandhi Jayanti"
        }));

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var isClosedResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/holidays/is-closed?branchId={branchId}&date=2026-10-02", tenantId));
        var body = await isClosedResponse.Content.ReadFromJsonAsync<IsClosedResponse>();

        Assert.True(body!.IsClosed);
    }

    [Fact]
    public async Task GetIsClosed_OnANonHolidayDate_ReturnsFalse()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/holidays/is-closed?branchId={branchId}&date=2026-10-03", tenantId));
        var body = await response.Content.ReadFromJsonAsync<IsClosedResponse>();

        Assert.False(body!.IsClosed);
    }

    [Fact]
    public async Task PostHoliday_WithCrossTenantBranch_ReturnsValidationProblem()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantA);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantB, new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 10, 2),
            Reason = "Cross-tenant attempt"
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostHoliday_DuplicateBranchAndDate_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);
        var request = new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 12, 25),
            Reason = "Christmas"
        };
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, request));

        var secondResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, request));

        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteHoliday_RemovesIt_IsClosedBecomesFalse()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 11, 1),
            Reason = "Test Holiday"
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<HolidayResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/holidays/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var isClosedResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/holidays/is-closed?branchId={branchId}&date=2026-11-01", tenantId));
        var body = await isClosedResponse.Content.ReadFromJsonAsync<IsClosedResponse>();

        Assert.False(body!.IsClosed);
    }

    [Fact]
    public async Task GetHolidays_FilteredByBranchAndDateRange_ReturnsOnlyMatching()
    {
        var tenantId = Guid.NewGuid();
        var branchId = await CreateBranchAsync(tenantId);
        var otherBranchId = await CreateBranchAsync(tenantId);
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, new CreateHolidayRequest
        {
            BranchId = branchId,
            Date = new DateOnly(2026, 8, 20),
            Reason = "In range"
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/holidays", tenantId, new CreateHolidayRequest
        {
            BranchId = otherBranchId,
            Date = new DateOnly(2026, 8, 20),
            Reason = "Different branch"
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/holidays?branchId={branchId}&from=2026-08-01&to=2026-08-31", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<HolidayResponse>>();

        Assert.Single(body!.Items);
        Assert.Equal("In range", body.Items[0].Reason);
    }
}
