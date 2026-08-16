using DirectoryApi.Data;
using DirectoryApi.Entities;
using DirectoryApi.Tests.Fixtures;
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
}
