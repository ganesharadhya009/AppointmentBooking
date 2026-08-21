using SchedulingApi.Clients;
using SchedulingApi.Data;
using SchedulingApi.Tests.Fakes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace SchedulingApi.Tests.Fixtures;

public class LocalDbTestFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _databaseName = $"schedulingapitest_{Guid.NewGuid():N}";

    public string ConnectionString =>
        $"Host=localhost;Port=5432;Database={_databaseName};Username=postgres;Password={Environment.GetEnvironmentVariable("LOCAL_POSTGRES_PASSWORD") ?? "postgres"}";

    public FakeDirectoryApiClient DirectoryApiClient { get; } = new();
    public FakeClientRecordsApiClient ClientRecordsApiClient { get; } = new();
    public FakeBillingApiClient BillingApiClient { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:SchedulingDb"] = ConnectionString
            });
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IDirectoryApiClient>();
            services.AddSingleton<IDirectoryApiClient>(DirectoryApiClient);
            services.RemoveAll<IClientRecordsApiClient>();
            services.AddSingleton<IClientRecordsApiClient>(ClientRecordsApiClient);
            services.RemoveAll<IBillingApiClient>();
            services.AddSingleton<IBillingApiClient>(BillingApiClient);
        });
    }

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
        await db.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
        await db.Database.EnsureDeletedAsync();
        await base.DisposeAsync();
    }
}
