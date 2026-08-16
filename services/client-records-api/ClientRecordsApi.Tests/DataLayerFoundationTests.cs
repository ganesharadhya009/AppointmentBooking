using ClientRecordsApi.Data;
using ClientRecordsApi.Entities;
using ClientRecordsApi.Tests.Fixtures;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ClientRecordsApi.Tests;

public class DataLayerFoundationTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;

    public DataLayerFoundationTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CanInsertAndRetrieveAParentAndChild_ThroughMigratedLocalDb()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClientRecordsDbContext>();

        var parent = new Parent
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Name = "Test Parent",
            MobileNumber = "9999999999",
            Email = "parent@example.com",
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = "system"
        };
        var child = new Child
        {
            Id = Guid.NewGuid(),
            TenantId = parent.TenantId,
            ParentId = parent.Id,
            Name = "Test Child",
            DateOfBirth = new DateOnly(2018, 1, 1),
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = "system"
        };

        db.Parents.Add(parent);
        db.Children.Add(child);
        await db.SaveChangesAsync();

        using var readScope = _fixture.Services.CreateScope();
        var readDb = readScope.ServiceProvider.GetRequiredService<ClientRecordsDbContext>();
        var foundParent = await readDb.Parents.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == parent.Id);
        var foundChild = await readDb.Children.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == child.Id);

        Assert.NotNull(foundParent);
        Assert.Equal("Test Parent", foundParent!.Name);
        Assert.NotNull(foundChild);
        Assert.Equal(parent.Id, foundChild!.ParentId);
    }

    [Fact]
    public async Task HealthEndpoint_StillWorks_WithFullDataLayerWired()
    {
        var client = _fixture.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }
}
