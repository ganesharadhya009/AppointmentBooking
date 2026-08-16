using System.Net;
using System.Net.Http.Json;
using DirectoryApi.Common;
using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Xunit;

namespace DirectoryApi.Tests;

public class TherapistEndpointsTests : IClassFixture<LocalDbTestFixture>
{
    private readonly HttpClient _client;

    public TherapistEndpointsTests(LocalDbTestFixture fixture)
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

    private static List<DiscountTierDto> ValidBranchTiers() =>
    [
        new() { SessionCount = 10, DiscountPerSession = 50 },
        new() { SessionCount = 24, DiscountPerSession = 100 },
        new() { SessionCount = 48, DiscountPerSession = 150 },
        new() { SessionCount = 72, DiscountPerSession = 200 },
        new() { SessionCount = 96, DiscountPerSession = 250 }
    ];

    private async Task<(Guid branchId, Guid therapyTypeId)> CreateBranchAndTherapyTypeAsync(Guid tenantId)
    {
        var branchResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/branches", tenantId, new CreateBranchRequest
        {
            Name = "Test Branch For Therapist",
            WeeklyDayOff = DayOfWeek.Sunday,
            DiscountTiers = ValidBranchTiers()
        }));
        var branch = await branchResponse.Content.ReadFromJsonAsync<BranchResponse>();

        var therapyTypeResponse = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapy-types", tenantId, new CreateTherapyTypeRequest
        {
            Name = "Test Therapy For Therapist"
        }));
        var therapyType = await therapyTypeResponse.Content.ReadFromJsonAsync<TherapyTypeResponse>();

        return (branch!.Id, therapyType!.Id);
    }

    private static AssignmentDto BuildAssignment(Guid branchId, Guid therapyTypeId) => new()
    {
        BranchId = branchId,
        TherapyTypeId = therapyTypeId,
        JoiningDate = new DateOnly(2026, 1, 1),
        WeeklyDayOff = DayOfWeek.Sunday,
        SessionWindows =
        [
            new SessionWindowDto { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 }
        ]
    };

    [Fact]
    public async Task PostThenGetTherapist_RoundTripsWithNestedAssignment()
    {
        var tenantId = Guid.NewGuid();
        var (branchId, therapyTypeId) = await CreateBranchAndTherapyTypeAsync(tenantId);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
        {
            Name = "Dr. Test Therapist",
            MobileNumber = "9999999999",
            Email = "test@example.com",
            LicenseNumber = "LIC-100",
            Designation = "Occupational Therapist",
            Assignments = [BuildAssignment(branchId, therapyTypeId)]
        }));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var createdBody = await created.Content.ReadFromJsonAsync<TherapistResponse>();

        var fetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/therapists/{createdBody!.Id}", tenantId));
        var fetchedBody = await fetched.Content.ReadFromJsonAsync<TherapistResponse>();

        Assert.Equal("Dr. Test Therapist", fetchedBody!.Name);
        Assert.Single(fetchedBody.Assignments);
        Assert.Single(fetchedBody.Assignments[0].SessionWindows);
    }

    [Fact]
    public async Task PostTherapist_WithNoAssignments_ReturnsValidationProblem()
    {
        var tenantId = Guid.NewGuid();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
        {
            Name = "No Assignment Therapist",
            MobileNumber = "9999999999",
            Email = "test2@example.com",
            LicenseNumber = "LIC-101",
            Designation = "Occupational Therapist",
            Assignments = []
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostTherapist_WithCrossTenantBranch_ReturnsValidationProblem()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var (branchIdOfTenantB, therapyTypeIdOfTenantB) = await CreateBranchAndTherapyTypeAsync(tenantB);

        var response = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantA, new CreateTherapistRequest
        {
            Name = "Cross Tenant Therapist",
            MobileNumber = "9999999999",
            Email = "test3@example.com",
            LicenseNumber = "LIC-102",
            Designation = "Occupational Therapist",
            Assignments = [BuildAssignment(branchIdOfTenantB, therapyTypeIdOfTenantB)]
        }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutTherapist_ReplacesAssignmentGraph_OldAssignmentGone_NewOnePresent()
    {
        var tenantId = Guid.NewGuid();
        var (branchId1, therapyTypeId1) = await CreateBranchAndTherapyTypeAsync(tenantId);
        var (branchId2, therapyTypeId2) = await CreateBranchAndTherapyTypeAsync(tenantId);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
        {
            Name = "Replace Test Therapist",
            MobileNumber = "9999999999",
            Email = "test4@example.com",
            LicenseNumber = "LIC-103",
            Designation = "Occupational Therapist",
            Assignments = [BuildAssignment(branchId1, therapyTypeId1)]
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<TherapistResponse>();

        var updateResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/therapists/{createdBody!.Id}", tenantId, new UpdateTherapistRequest
        {
            Name = "Replace Test Therapist",
            MobileNumber = "9999999999",
            Email = "test4@example.com",
            LicenseNumber = "LIC-103",
            Designation = "Occupational Therapist",
            Status = TherapistStatus.Active,
            Assignments = [BuildAssignment(branchId2, therapyTypeId2)]
        }));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updatedBody = await updateResponse.Content.ReadFromJsonAsync<TherapistResponse>();
        Assert.Single(updatedBody!.Assignments);
        Assert.Equal(branchId2, updatedBody.Assignments[0].BranchId);

        var refetched = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/therapists/{createdBody.Id}", tenantId));
        var refetchedBody = await refetched.Content.ReadFromJsonAsync<TherapistResponse>();
        Assert.Single(refetchedBody!.Assignments);
        Assert.Equal(branchId2, refetchedBody.Assignments[0].BranchId);
    }

    [Fact]
    public async Task PutTherapist_CannotReactivateADeletedOne()
    {
        var tenantId = Guid.NewGuid();
        var (branchId, therapyTypeId) = await CreateBranchAndTherapyTypeAsync(tenantId);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantId, new CreateTherapistRequest
        {
            Name = "Delete Test Therapist",
            MobileNumber = "9999999999",
            Email = "test5@example.com",
            LicenseNumber = "LIC-104",
            Designation = "Occupational Therapist",
            Assignments = [BuildAssignment(branchId, therapyTypeId)]
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<TherapistResponse>();
        await _client.SendAsync(WithTenant(HttpMethod.Delete, $"/therapists/{createdBody!.Id}", tenantId));

        var reactivateResponse = await _client.SendAsync(WithTenant(HttpMethod.Put, $"/therapists/{createdBody.Id}", tenantId, new UpdateTherapistRequest
        {
            Name = "Delete Test Therapist",
            MobileNumber = "9999999999",
            Email = "test5@example.com",
            LicenseNumber = "LIC-104",
            Designation = "Occupational Therapist",
            Status = TherapistStatus.Active,
            Assignments = [BuildAssignment(branchId, therapyTypeId)]
        }));

        Assert.Equal(HttpStatusCode.BadRequest, reactivateResponse.StatusCode);
    }

    [Fact]
    public async Task GetTherapistById_UnderAnotherTenant_Returns404()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var (branchId, therapyTypeId) = await CreateBranchAndTherapyTypeAsync(tenantA);

        var created = await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantA, new CreateTherapistRequest
        {
            Name = "Tenant A Only Therapist",
            MobileNumber = "9999999999",
            Email = "test6@example.com",
            LicenseNumber = "LIC-105",
            Designation = "Occupational Therapist",
            Assignments = [BuildAssignment(branchId, therapyTypeId)]
        }));
        var createdBody = await created.Content.ReadFromJsonAsync<TherapistResponse>();

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, $"/therapists/{createdBody!.Id}", tenantB));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListTherapists_NeverReturnsAnotherTenantsTherapists()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var (branchIdA, therapyTypeIdA) = await CreateBranchAndTherapyTypeAsync(tenantA);
        var (branchIdB, therapyTypeIdB) = await CreateBranchAndTherapyTypeAsync(tenantB);

        await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantA, new CreateTherapistRequest
        {
            Name = "Tenant A Therapist",
            MobileNumber = "9999999999",
            Email = "tenanta@example.com",
            LicenseNumber = "LIC-A",
            Designation = "Occupational Therapist",
            Assignments = [BuildAssignment(branchIdA, therapyTypeIdA)]
        }));
        await _client.SendAsync(WithTenant(HttpMethod.Post, "/therapists", tenantB, new CreateTherapistRequest
        {
            Name = "Tenant B Therapist",
            MobileNumber = "9999999999",
            Email = "tenantb@example.com",
            LicenseNumber = "LIC-B",
            Designation = "Occupational Therapist",
            Assignments = [BuildAssignment(branchIdB, therapyTypeIdB)]
        }));

        var response = await _client.SendAsync(WithTenant(HttpMethod.Get, "/therapists", tenantA));
        var body = await response.Content.ReadFromJsonAsync<PagedResult<TherapistResponse>>();

        Assert.All(body!.Items, t => Assert.NotEqual("Tenant B Therapist", t.Name));
        Assert.Contains(body.Items, t => t.Name == "Tenant A Therapist");
    }
}
