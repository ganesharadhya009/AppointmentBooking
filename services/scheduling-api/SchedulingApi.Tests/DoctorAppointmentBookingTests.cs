using System.Net;
using System.Net.Http.Json;
using SchedulingApi.Clients;
using SchedulingApi.Common;
using SchedulingApi.Dtos;
using SchedulingApi.Entities;
using SchedulingApi.Tests.Fixtures;
using Xunit;

namespace SchedulingApi.Tests;

public class DoctorAppointmentBookingTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;
    private readonly HttpClient _client;

    public DoctorAppointmentBookingTests(LocalDbTestFixture fixture)
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

    private void SetUpValidReferences(Guid doctorId, Guid childId, Guid? clinicId = null, Guid? serviceId = null)
    {
        _fixture.DirectoryApiClient.ConsultantDoctorToReturn = new ConsultantDoctorInfo
        {
            Id = doctorId,
            ConsultantClinicId = clinicId ?? Guid.NewGuid(),
            ConsultantServiceId = serviceId ?? Guid.NewGuid(),
            ConsultationFee = 800,
            Status = RemoteConsultantStatus.Active
        };
        _fixture.ClientRecordsApiClient.ChildToReturn = new ChildInfo { Id = childId, Status = RemoteClientStatus.Active };
    }

    [Fact]
    public async Task PostDoctorAppointment_WithValidReferences_CreatesAppointment()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var body = await response.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(AppointmentStatus.Planned, body!.Status);
        Assert.Equal(800, body.ConsultationFee);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithoutIdempotencyKey_Returns400()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, idempotencyKey: null, body: new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = Guid.NewGuid(),
            ChildId = Guid.NewGuid(),
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithSameIdempotencyKeyTwice_ReturnsTheSameAppointmentBothTimes()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var idempotencyKey = Guid.NewGuid().ToString();
        var request = new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        };

        var first = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, idempotencyKey, request));
        var firstBody = await first.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        var second = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, idempotencyKey, request));
        var secondBody = await second.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        Assert.Equal(firstBody!.Id, secondBody!.Id);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithInactiveDoctor_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        _fixture.DirectoryApiClient.ConsultantDoctorToReturn!.Status = RemoteConsultantStatus.Inactive;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithInactiveChild_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        _fixture.ClientRecordsApiClient.ChildToReturn!.Status = RemoteClientStatus.Inactive;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostDoctorAppointment_WhenSlotAlreadyBooked_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var request = new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        };
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), request));

        var secondBooking = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), request));

        Assert.Equal(HttpStatusCode.Conflict, secondBooking.StatusCode);
    }

    [Fact]
    public async Task GetDoctorAppointmentById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantA, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/doctor-appointments/{created!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListDoctorAppointments_ReturnsPagedResultEnvelope()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/doctor-appointments", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<DoctorAppointmentResponse>>();

        Assert.Equal(1, body!.TotalCount);
        Assert.Single(body.Items);
    }

    [Fact]
    public async Task PutDoctorAppointment_ReschedulesToADifferentTime()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/doctor-appointments/{created!.Id}", tenantId, body: new UpdateDoctorAppointmentRequest
        {
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(14, 0)
        }));
        var putBody = await putResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);
        Assert.Equal(new TimeOnly(14, 0), putBody!.AppointmentTime);
    }

    [Fact]
    public async Task PutDoctorAppointment_OnCancelledAppointment_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/doctor-appointments/{created!.Id}", tenantId));

        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/doctor-appointments/{created.Id}", tenantId, body: new UpdateDoctorAppointmentRequest
        {
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(15, 0)
        }));

        Assert.Equal(HttpStatusCode.Conflict, putResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteDoctorAppointment_CancelsIt_SlotBecomesBookableAgain()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var request = new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        };
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), request));
        var created = await createResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/doctor-appointments/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var rebookResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), request));
        Assert.Equal(HttpStatusCode.Created, rebookResponse.StatusCode);
    }

    [Fact]
    public async Task PutDoctorAppointment_WithInactiveDoctor_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();
        _fixture.DirectoryApiClient.ConsultantDoctorToReturn!.Status = RemoteConsultantStatus.Inactive;

        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/doctor-appointments/{created!.Id}", tenantId, body: new UpdateDoctorAppointmentRequest
        {
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(14, 0)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, putResponse.StatusCode);
    }

    [Fact]
    public async Task PutDoctorAppointment_OntoAnAlreadyBookedSlot_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        var firstCreateResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));
        var firstCreated = await firstCreateResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();
        var secondCreateResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(14, 0)
        }));
        var secondCreated = await secondCreateResponse.Content.ReadFromJsonAsync<DoctorAppointmentResponse>();

        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/doctor-appointments/{secondCreated!.Id}", tenantId, body: new UpdateDoctorAppointmentRequest
        {
            AppointmentDate = firstCreated!.AppointmentDate,
            AppointmentTime = firstCreated.AppointmentTime
        }));

        Assert.Equal(HttpStatusCode.Conflict, putResponse.StatusCode);
    }

    [Fact]
    public async Task ListDoctorAppointments_NeverReturnsAnotherTenantsAppointments()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        var doctorIdA = Guid.NewGuid();
        var childIdA = Guid.NewGuid();
        SetUpValidReferences(doctorIdA, childIdA);
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantA, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorIdA,
            ChildId = childIdA,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        var doctorIdB = Guid.NewGuid();
        var childIdB = Guid.NewGuid();
        SetUpValidReferences(doctorIdB, childIdB);
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantB, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorIdB,
            ChildId = childIdB,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/doctor-appointments", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<DoctorAppointmentResponse>>();

        Assert.Equal(1, body!.TotalCount);
        Assert.Single(body.Items);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithNonexistentDoctor_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        _fixture.DirectoryApiClient.ConsultantDoctorToReturn = null;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = Guid.NewGuid(),
            ChildId = Guid.NewGuid(),
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostDoctorAppointment_WithNonexistentChild_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        SetUpValidReferences(doctorId, childId);
        _fixture.ClientRecordsApiClient.ChildToReturn = null;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/doctor-appointments", tenantId, Guid.NewGuid().ToString(), new CreateDoctorAppointmentRequest
        {
            ConsultantDoctorId = doctorId,
            ChildId = childId,
            AppointmentDate = new DateOnly(2026, 9, 1),
            AppointmentTime = new TimeOnly(10, 0)
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
