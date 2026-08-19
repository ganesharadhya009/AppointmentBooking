using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class LeaveRequestEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public LeaveRequestEndpointsTests(LocalDbTestFixture fixture)
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

    private async Task<Guid> CreateTherapistAsync(Guid tenantId)
    {
        var branchResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/branches", tenantId, new CreateBranchRequest
        {
            Name = "Test Branch For Leave",
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
        var branch = await branchResponse.Content.ReadFromJsonAsync<BranchResponse>();

        var therapyTypeResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapy-types", tenantId, new CreateTherapyTypeRequest
        {
            Name = "Test Therapy For Leave"
        }));
        var therapyType = await therapyTypeResponse.Content.ReadFromJsonAsync<TherapyTypeResponse>();

        var therapistResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
        {
            Name = "Test Therapist For Leave",
            MobileNumber = "7777777777",
            Email = "leave-therapist@example.com",
            LicenseNumber = "LIC-LEAVE",
            Designation = "Therapist",
            Assignments =
            [
                new AssignmentDto
                {
                    BranchId = branch!.Id,
                    TherapyTypeId = therapyType!.Id,
                    JoiningDate = new DateOnly(2026, 1, 1),
                    WeeklyDayOff = DayOfWeek.Sunday,
                    SessionWindows = [new SessionWindowDto { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 }]
                }
            ]
        }));
        var therapist = await therapistResponse.Content.ReadFromJsonAsync<TherapistResponse>();
        return therapist!.Id;
    }

    [Fact]
    public async Task PostLeaveRequest_ThenGetIsOnLeave_ReturnsFalseUntilApproved()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);

        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(LeaveRequestStatus.Pending, created!.Status);

        var isOnLeaveResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/leave-requests/is-on-leave?therapistId={therapistId}&date=2026-10-03", tenantId));
        var isOnLeaveBody = await isOnLeaveResponse.Content.ReadFromJsonAsync<IsOnLeaveResponse>();

        Assert.False(isOnLeaveBody!.IsOnLeave);
    }

    [Fact]
    public async Task ApproveLeaveRequest_ThenGetIsOnLeave_ReturnsTrueWithinRange()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();

        var approveResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/leave-requests/{created!.Id}/approve", tenantId));
        Assert.Equal(HttpStatusCode.OK, approveResponse.StatusCode);

        var isOnLeaveResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/leave-requests/is-on-leave?therapistId={therapistId}&date=2026-10-03", tenantId));
        var isOnLeaveBody = await isOnLeaveResponse.Content.ReadFromJsonAsync<IsOnLeaveResponse>();

        Assert.True(isOnLeaveBody!.IsOnLeave);

        var outsideRangeResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/leave-requests/is-on-leave?therapistId={therapistId}&date=2026-10-10", tenantId));
        var outsideRangeBody = await outsideRangeResponse.Content.ReadFromJsonAsync<IsOnLeaveResponse>();

        Assert.False(outsideRangeBody!.IsOnLeave);
    }

    [Fact]
    public async Task ApproveLeaveRequest_CalledTwice_SecondCallReturns409()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Post, $"/leave-requests/{created!.Id}/approve", tenantId));

        var secondApprove = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/leave-requests/{created.Id}/approve", tenantId));

        Assert.Equal(HttpStatusCode.Conflict, secondApprove.StatusCode);
    }

    [Fact]
    public async Task PostLeaveRequest_WithEndDateBeforeStartDate_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 5),
            EndDate = new DateOnly(2026, 10, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostLeaveRequest_WithCrossTenantTherapist_ReturnsValidationProblem()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantA);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantB, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RejectLeaveRequest_SetsStatusToRejected()
    {
        var tenantId = Guid.NewGuid();
        var therapistId = await CreateTherapistAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/leave-requests", tenantId, new CreateLeaveRequestRequest
        {
            TherapistId = therapistId,
            StartDate = new DateOnly(2026, 10, 1),
            EndDate = new DateOnly(2026, 10, 5)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();

        var rejectResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/leave-requests/{created!.Id}/reject", tenantId));
        var rejectBody = await rejectResponse.Content.ReadFromJsonAsync<LeaveRequestResponse>();

        Assert.Equal(HttpStatusCode.OK, rejectResponse.StatusCode);
        Assert.Equal(LeaveRequestStatus.Rejected, rejectBody!.Status);
    }
}
