using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class ConsultantDoctorEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public ConsultantDoctorEndpointsTests(LocalDbTestFixture fixture)
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

    private async Task<(Guid serviceId, Guid clinicId)> CreateServiceAndClinicAsync(Guid tenantId, string? city = null)
    {
        var serviceResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-services", tenantId, new CreateConsultantServiceRequest
        {
            Name = "Test Service"
        }));
        var service = await serviceResponse.Content.ReadFromJsonAsync<ConsultantServiceResponse>();

        var clinicResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-clinics", tenantId, new CreateConsultantClinicRequest
        {
            Name = "Test Clinic",
            City = city
        }));
        var clinic = await clinicResponse.Content.ReadFromJsonAsync<ConsultantClinicResponse>();

        return (service!.Id, clinic!.Id);
    }

    [Fact]
    public async Task PostConsultantDoctor_WithValidReferences_CreatesDoctor()
    {
        var tenantId = Guid.NewGuid();
        var (serviceId, clinicId) = await CreateServiceAndClinicAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Dr. Test",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = clinicId,
            ConsultationFee = 800
        }));
        var body = await response.Content.ReadFromJsonAsync<ConsultantDoctorResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(800, body!.ConsultationFee);
    }

    [Fact]
    public async Task PostConsultantDoctor_WithCrossTenantService_ReturnsValidationProblem()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var (serviceId, _) = await CreateServiceAndClinicAsync(tenantA);
        var (_, clinicId) = await CreateServiceAndClinicAsync(tenantB);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantB, new CreateConsultantDoctorRequest
        {
            Name = "Dr. Cross Tenant",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = clinicId,
            ConsultationFee = 500
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostConsultantDoctor_WithNonexistentClinic_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var (serviceId, _) = await CreateServiceAndClinicAsync(tenantId);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Dr. No Clinic",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = Guid.NewGuid(),
            ConsultationFee = 500
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetConsultantDoctors_FilteredByServiceAndCity_ReturnsOnlyMatching()
    {
        var tenantId = Guid.NewGuid();
        var (serviceId, clinicId) = await CreateServiceAndClinicAsync(tenantId, city: "Mumbai");
        var (otherServiceId, otherClinicId) = await CreateServiceAndClinicAsync(tenantId, city: "Delhi");

        await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Matching Doctor",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = clinicId,
            ConsultationFee = 700
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Non-Matching Doctor",
            ConsultantServiceId = otherServiceId,
            ConsultantClinicId = otherClinicId,
            ConsultationFee = 700
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            $"/consultant-doctors?consultantServiceId={serviceId}&city=Mumbai", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<ConsultantDoctorResponse>>();

        Assert.Single(body!.Items);
        Assert.Equal("Matching Doctor", body.Items[0].Name);
    }

    [Fact]
    public async Task DeleteConsultantDoctor_SetsStatusToInactive()
    {
        var tenantId = Guid.NewGuid();
        var (serviceId, clinicId) = await CreateServiceAndClinicAsync(tenantId);
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/consultant-doctors", tenantId, new CreateConsultantDoctorRequest
        {
            Name = "Dr. To Delete",
            ConsultantServiceId = serviceId,
            ConsultantClinicId = clinicId,
            ConsultationFee = 500
        }));
        var created = await createResponse.Content.ReadFromJsonAsync<ConsultantDoctorResponse>();

        var deleteResponse = await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/consultant-doctors/{created!.Id}", tenantId));
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/consultant-doctors/{created.Id}", tenantId));
        var body = await getResponse.Content.ReadFromJsonAsync<ConsultantDoctorResponse>();
        Assert.Equal(ConsultantStatus.Inactive, body!.Status);
    }
}
