using System.Net;
using System.Net.Http.Json;
using SchedulingApi.Clients;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Tests.Fixtures;
using Xunit;

namespace SchedulingApi.Tests;

public class AppointmentBookingTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;
    private readonly HttpClient _client;

    public AppointmentBookingTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.CreateClient();
    }

    private HttpRequestMessage WithTenant(HttpMethod method, string url, Guid tenantId, string? idempotencyKey = null, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-Tenant-Id", tenantId.ToString());
        if (idempotencyKey is not null)
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return request;
    }

    private void SetUpValidReferences(Guid branchId, Guid therapistId, Guid therapyTypeId, Guid childId)
    {
        _fixture.DirectoryApiClient.BranchToReturn = new BranchInfo { Id = branchId, IsActive = true };
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
                    SessionWindows = [new SessionWindowInfo { WindowName = SchedulingApi.Clients.SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 }]
                }
            ]
        };
        _fixture.ClientRecordsApiClient.ChildToReturn = new ChildInfo { Id = childId, Status = RemoteClientStatus.Active };
    }

    [Fact]
    public async Task PostAppointment_WithValidReferences_CreatesAppointment()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<AppointmentResponse>();
        Assert.Equal(AppointmentStatus.Planned, body!.Status);
        Assert.Equal(500, body.PricePerSession);
    }

    [Fact]
    public async Task PostAppointment_WithoutIdempotencyKey_Returns400()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, idempotencyKey: null, body: new CreateAppointmentRequest
        {
            BranchId = Guid.NewGuid(),
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = Guid.NewGuid(),
            ChildId = Guid.NewGuid(),
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostAppointment_WithSameIdempotencyKeyTwice_ReturnsTheSameAppointmentBothTimes_OnlyOneRowPersisted()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        var idempotencyKey = Guid.NewGuid().ToString();
        var request = new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        };

        var first = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, idempotencyKey, request));
        var firstBody = await first.Content.ReadFromJsonAsync<AppointmentResponse>();

        var second = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, idempotencyKey, request));
        var secondBody = await second.Content.ReadFromJsonAsync<AppointmentResponse>();

        Assert.Equal(firstBody!.Id, secondBody!.Id);

        var listResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, "/appointments", tenantId));
        var listBody = await listResponse.Content.ReadFromJsonAsync<Common.PagedResult<AppointmentResponse>>();
        Assert.Single(listBody!.Items, a => a.Id == firstBody.Id);
    }

    [Fact]
    public async Task PostAppointment_WithCrossTenantBranch_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        _fixture.DirectoryApiClient.BranchToReturn = null;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = Guid.NewGuid(),
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = Guid.NewGuid(),
            ChildId = Guid.NewGuid(),
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostAppointment_WhenWindowAlreadyBooked_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        var request = new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        };
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), request));

        var secondBooking = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), request));

        Assert.Equal(HttpStatusCode.Conflict, secondBooking.StatusCode);
    }

    [Fact]
    public async Task PostAppointment_WithTherapistNotFound_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        _fixture.DirectoryApiClient.TherapistToReturn = null;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostAppointment_WithInactiveTherapist_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        _fixture.DirectoryApiClient.TherapistToReturn!.Status = RemoteStatus.Inactive;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostAppointment_WithTherapistNotAssignedToBranchOrTherapyType_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        _fixture.DirectoryApiClient.TherapistToReturn = new TherapistInfo
        {
            Id = therapistId,
            Status = RemoteStatus.Active,
            Assignments =
            [
                new TherapistAssignmentInfo
                {
                    BranchId = Guid.NewGuid(),
                    TherapyTypeId = Guid.NewGuid(),
                    SessionWindows = [new SessionWindowInfo { WindowName = SchedulingApi.Clients.SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 }]
                }
            ]
        };

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostAppointment_WithChildNotFound_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(branchId, therapistId, therapyTypeId, childId);
        _fixture.ClientRecordsApiClient.ChildToReturn = null;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
