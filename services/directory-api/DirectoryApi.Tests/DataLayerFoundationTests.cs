using DirectoryApi.Data;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DirectoryApi.Tests;

public class DataLayerFoundationTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;

    public DataLayerFoundationTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CanInsertAndRetrieveATenant_ThroughMigratedLocalDb()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DirectoryDbContext>();

        var tenant = new Tenant { Id = Guid.NewGuid(), Name = "Test Tenant", CreatedAt = DateTimeOffset.UtcNow };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        using var readScope = _fixture.Services.CreateScope();
        var readDb = readScope.ServiceProvider.GetRequiredService<DirectoryDbContext>();
        var found = await readDb.Tenants.FindAsync(tenant.Id);

        Assert.NotNull(found);
        Assert.Equal("Test Tenant", found!.Name);
    }

    [Fact]
    public async Task HealthEndpoint_StillWorks_WithFullDataLayerWired()
    {
        var client = _fixture.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CanInsertAndRetrieveATherapistWithNestedAssignments()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DirectoryDbContext>();

        var therapist = new Therapist
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Name = "Test Therapist",
            MobileNumber = "9999999999",
            Email = "therapist@example.com",
            LicenseNumber = "LIC-001",
            Designation = "Occupational Therapist",
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = "system",
            Assignments =
            [
                new TherapistAssignment
                {
                    Id = Guid.NewGuid(),
                    BranchId = Guid.NewGuid(),
                    TherapyTypeId = Guid.NewGuid(),
                    JoiningDate = new DateOnly(2026, 1, 1),
                    WeeklyDayOff = DayOfWeek.Sunday,
                    SessionWindows =
                    [
                        new TherapistSessionWindow
                        {
                            Id = Guid.NewGuid(),
                            WindowName = SessionWindowName.Morning,
                            StartTime = new TimeOnly(9, 0),
                            EndTime = new TimeOnly(12, 0),
                            PricePerSession = 500
                        }
                    ]
                }
            ]
        };

        db.Therapists.Add(therapist);
        await db.SaveChangesAsync();

        using var readScope = _fixture.Services.CreateScope();
        var readDb = readScope.ServiceProvider.GetRequiredService<DirectoryDbContext>();
        var found = await readDb.Therapists
            .IgnoreQueryFilters()
            .Include(t => t.Assignments).ThenInclude(a => a.SessionWindows)
            .FirstOrDefaultAsync(t => t.Id == therapist.Id);

        Assert.NotNull(found);
        Assert.Single(found!.Assignments);
        Assert.Single(found.Assignments[0].SessionWindows);
        Assert.Equal(SessionWindowName.Morning, found.Assignments[0].SessionWindows[0].WindowName);
    }
}
