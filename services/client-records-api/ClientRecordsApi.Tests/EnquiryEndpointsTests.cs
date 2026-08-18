using System.Net;
using System.Net.Http.Json;
using ClientRecordsApi.Common;
using ClientRecordsApi.Dtos;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tests.Fixtures;
using Xunit;

namespace ClientRecordsApi.Tests;

public class EnquiryEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public EnquiryEndpointsTests(LocalDbTestFixture fixture)
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

    private static CreateEnquiryRequest ValidRequest() => new()
    {
        ParentName = "Test Parent",
        ParentMobileNumber = "9999999999",
        ParentEmail = "parent@example.com",
        ChildName = "Test Child",
        ChildDateOfBirth = new DateOnly(2020, 1, 1),
        Concerns = ["Speech delay", "Motor skills"]
    };

    [Fact]
    public async Task PostEnquiry_WithoutStatus_DefaultsToDraft()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var body = await response.Content.ReadFromJsonAsync<EnquiryResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(EnquiryStatus.Draft, body!.Status);
        Assert.Equal(2, body.Concerns.Count);
    }

    [Fact]
    public async Task PostEnquiry_WithConvertedStatus_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var request = ValidRequest();
        request.Status = EnquiryStatus.Converted;

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, request));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetEnquiryById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantA, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/enquiries/{created!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutEnquiry_UpdatesConcernsList_RoundTripsCorrectly()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var updateRequest = ValidRequest();
        updateRequest.Concerns = ["Updated concern only"];
        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/enquiries/{created!.Id}", tenantId, updateRequest));
        var putBody = await putResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);
        Assert.Single(putBody!.Concerns);
        Assert.Equal("Updated concern only", putBody.Concerns[0]);
    }

    [Fact]
    public async Task PutEnquiry_SettingStatusToConvertedDirectly_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var updateRequest = ValidRequest();
        updateRequest.Status = EnquiryStatus.Converted;
        var response = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/enquiries/{created!.Id}", tenantId, updateRequest));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetEnquiries_FilteredByStatusAndContactNumber_ReturnsOnlyMatching()
    {
        var tenantId = Guid.NewGuid();
        var matching = ValidRequest();
        matching.ParentMobileNumber = "8888888888";
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, matching));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get,
            "/enquiries?status=Draft&contactNumber=8888888888", tenantId));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<EnquiryResponse>>();

        Assert.Single(body!.Items);
        Assert.Equal("8888888888", body.Items[0].ParentMobileNumber);
    }

    [Fact]
    public async Task ConvertEnquiry_CreatesExactlyOneParentAndChild()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var convertResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created!.Id}/convert", tenantId));
        var convertBody = await convertResponse.Content.ReadFromJsonAsync<ConvertEnquiryResponse>();

        Assert.Equal(HttpStatusCode.OK, convertResponse.StatusCode);

        var parentResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/parents/{convertBody!.ParentId}", tenantId));
        var parentBody = await parentResponse.Content.ReadFromJsonAsync<ParentResponse>();
        Assert.Equal(HttpStatusCode.OK, parentResponse.StatusCode);
        Assert.Equal("Test Parent", parentBody!.Name);

        var childResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/children/{convertBody.ChildId}", tenantId));
        var childBody = await childResponse.Content.ReadFromJsonAsync<ChildResponse>();
        Assert.Equal(HttpStatusCode.OK, childResponse.StatusCode);
        Assert.Equal("Test Child", childBody!.Name);

        var enquiryResponse = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/enquiries/{created.Id}", tenantId));
        var enquiryBody = await enquiryResponse.Content.ReadFromJsonAsync<EnquiryResponse>();
        Assert.Equal(EnquiryStatus.Converted, enquiryBody!.Status);
        Assert.Equal(convertBody.ParentId, enquiryBody.ConvertedParentId);
        Assert.Equal(convertBody.ChildId, enquiryBody.ConvertedChildId);
    }

    [Fact]
    public async Task ConvertEnquiry_CalledTwice_SecondCallReturns409()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created!.Id}/convert", tenantId));

        var secondConvert = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created.Id}/convert", tenantId));

        Assert.Equal(HttpStatusCode.Conflict, secondConvert.StatusCode);
    }

    [Fact]
    public async Task ConvertEnquiry_WithoutChildDateOfBirth_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();
        var request = ValidRequest();
        request.ChildDateOfBirth = null;
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, request));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();

        var convertResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created!.Id}/convert", tenantId));

        Assert.Equal(HttpStatusCode.BadRequest, convertResponse.StatusCode);
    }

    [Fact]
    public async Task PutEnquiry_OnAConvertedEnquiry_Returns409()
    {
        var tenantId = Guid.NewGuid();
        var createResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/enquiries", tenantId, ValidRequest()));
        var created = await createResponse.Content.ReadFromJsonAsync<EnquiryResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Post, $"/enquiries/{created!.Id}/convert", tenantId));

        var putResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/enquiries/{created.Id}", tenantId, ValidRequest()));

        Assert.Equal(HttpStatusCode.Conflict, putResponse.StatusCode);
    }
}
