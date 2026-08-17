using System.Net;
using System.Net.Http.Json;
using SchedulingApi.Clients;
using SchedulingApi.Common;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Tests.Fixtures;
using Xunit;

namespace SchedulingApi.Tests;

public class AppointmentLifecycleTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;
    private readonly HttpClient _client;

    public AppointmentLifecycleTests(LocalDbTestFixture fixture)
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

    private async Task<(Guid appointmentId, Guid branchId, Guid therapistId, Guid therapyTypeId, Guid childId)> BookAnAppointmentAsync(Guid tenantId)
    {
        var branchId = Guid.NewGuid();
        var therapistId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        var childId = Guid.NewGuid();

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
                    SessionWindows =
                    [
                        new SessionWindowInfo { WindowName = SchedulingApi.Clients.SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 },
                        new SessionWindowInfo { WindowName = SchedulingApi.Clients.SessionWindowName.Afternoon, StartTime = new TimeOnly(14, 0), EndTime = new TimeOnly(16, 0), PricePerSession = 600 }
                    ]
                }
            ]
        };
        _fixture.ClientRecordsApiClient.ChildToReturn = new ChildInfo { Id = childId, Status = RemoteClientStatus.Active };

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/appointments", tenantId, Guid.NewGuid().ToString(), new CreateAppointmentRequest
        {
            BranchId = branchId,
            TherapistId = therapistId,
            TherapyTypeId = therapyTypeId,
            ChildId = childId,
            WindowName = SchedulingApi.Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));
        var body = await created.Content.ReadFromJsonAsync<AppointmentResponse>();

        return (body!.Id, branchId, therapistId, therapyTypeId, childId);
    }

    [Fact]
    public async Task GetAppointmentById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var (appointmentId, _, _, _, _) = await BookAnAppointmentAsync(tenantA);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/appointments/{appointmentId}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListAppointments_NeverReturnsAnotherTenantsAppointments()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        await BookAnAppointmentAsync(tenantA);
        await BookAnAppointmentAsync(tenantB);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/appointments", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<AppointmentResponse>>();

        Assert.Single(body!.Items);
    }

    [Fact]
    public async Task PutAppointment_ReschedulesToADifferentWindow()
    {
        var tenantId = Guid.NewGuid();
        var (appointmentId, _, _, _, _) = await BookAnAppointmentAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/appointments/{appointmentId}", tenantId, body: new UpdateAppointmentRequest
        {
            WindowName = SchedulingApi.Entities.SessionWindowName.Afternoon,
            AppointmentDate = new DateOnly(2026, 9, 1)
        }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<AppointmentResponse>();
        Assert.Equal(SchedulingApi.Entities.SessionWindowName.Afternoon, body!.WindowName);
        Assert.Equal(600, body.PricePerSession);
    }

    [Fact]
    public async Task DeleteAppointment_CancelsIt_SlotBecomesAvailableAgain()
    {
        var tenantId = Guid.NewGuid();
        var (appointmentId, branchId, therapistId, therapyTypeId, _) = await BookAnAppointmentAsync(tenantId);

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/appointments/{appointmentId}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var availabilityResponse = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/availability?branchId={branchId}&therapistId={therapistId}&therapyTypeId={therapyTypeId}&date=2026-09-01", tenantId));
        var availabilityBody = await availabilityResponse.Content.ReadFromJsonAsync<AvailabilityResponse>();

        Assert.Contains(SchedulingApi.Clients.SessionWindowName.Morning, availabilityBody!.AvailableWindows);
    }
}
