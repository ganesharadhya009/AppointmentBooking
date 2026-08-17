using SchedulingApi.Clients;
using SchedulingApi.Tests.Fixtures;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace SchedulingApi.Tests;

public class ClientDependencyInjectionTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;

    public ClientDependencyInjectionTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public void IDirectoryApiClient_ResolvesToTheFixturesFakeInstance()
    {
        var resolved = _fixture.Services.GetRequiredService<IDirectoryApiClient>();

        Assert.Same(_fixture.DirectoryApiClient, resolved);
    }

    [Fact]
    public void IClientRecordsApiClient_ResolvesToTheFixturesFakeInstance()
    {
        var resolved = _fixture.Services.GetRequiredService<IClientRecordsApiClient>();

        Assert.Same(_fixture.ClientRecordsApiClient, resolved);
    }
}
