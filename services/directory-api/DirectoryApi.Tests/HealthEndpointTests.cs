using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DirectoryApi.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        // Testing environment => Program.cs skips db.Database.Migrate() on startup. This test only
        // exercises /health, which never touches the database -- without this override, plain
        // WebApplicationFactory<Program> runs the app in its default (non-Testing) environment,
        // triggering a real migration attempt against appsettings.Development.json's connection
        // string. That was silently harmless under SQL Server LocalDB's trusted-connection auth,
        // but genuinely fails once the real local Postgres password doesn't match the committed
        // placeholder -- a pre-existing gap this test always had, only exposed by the Postgres
        // migration, not introduced by it.
        _client = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Testing")).CreateClient();
    }

    [Fact]
    public async Task Health_ReturnsOkWithServiceName()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("Healthy", body!["status"]);
        Assert.Equal("DirectoryApi", body["service"]);
    }
}
