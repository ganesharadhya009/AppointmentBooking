using System.Net;
using System.Net.Http.Json;
using SchedulingApi.Clients;
using SchedulingApi.Dtos;
using SchedulingApi.Tests.Fixtures;
using Xunit;

namespace SchedulingApi.Tests;

public class AvailabilityEndpointTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;
    private readonly HttpClient _client;

    public AvailabilityEndpointTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.CreateClient();
    }

    private HttpRequestMessage WithTenant(HttpMethod method, string url, Guid tenantId)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        return request;
    }

    [Fact]
    public async Task GetAvailability_ReturnsOpenWindows_WhenTherapistHasAssignmentAndNoBookings()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();

        _fixture.DirectoryApiClient.TherapistToReturn = new TherapistInfo
        {
            Id = therapistId,
            Status = RemoteStatus.Active,
            Assignments =
            [
                new TherapistAssignmentInfo
                {
                    BranchId = branchId,
                    TherapyTypeId = therapyTypeId,
                    SessionWindows = [new SessionWindowInfo { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 }]
                }
            ]
        };

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/availability?branchId={branchId}&therapistId={therapistId}&therapyTypeId={therapyTypeId}&date=2026-09-01", tenantId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<AvailabilityResponse>();
        Assert.Contains(SessionWindowName.Morning, body!.AvailableWindows);
    }

    [Fact]
    public async Task GetAvailability_Returns404_WhenTherapistNotFound()
    {
        var tenantId = Guid.NewGuid();
        _fixture.DirectoryApiClient.TherapistToReturn = null;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/availability?branchId={Guid.NewGuid()}&therapistId={Guid.NewGuid()}&therapyTypeId={Guid.NewGuid()}&date=2026-09-01", tenantId));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
