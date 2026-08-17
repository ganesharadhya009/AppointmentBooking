using SchedulingApi.Data;
using SchedulingApi.Entities;
using SchedulingApi.Tests.Fixtures;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace SchedulingApi.Tests;

public class DataLayerFoundationTests : IClassFixture<LocalDbTestFixture>
{
    private readonly LocalDbTestFixture _fixture;

    public DataLayerFoundationTests(LocalDbTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CanInsertAndRetrieveAnAppointment_ThroughMigratedLocalDb()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            BranchId = Guid.NewGuid(),
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = Guid.NewGuid(),
            ChildId = Guid.NewGuid(),
            WindowName = SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1),
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(12, 0),
            PricePerSession = 500,
            IdempotencyKey = Guid.NewGuid().ToString(),
            BookedBy = "system",
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();

        using var readScope = _fixture.Services.CreateScope();
        var readDb = readScope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
        var found = await readDb.Appointments.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.Id == appointment.Id);

        Assert.NotNull(found);
        Assert.Equal(SessionWindowName.Morning, found!.WindowName);
    }

    [Fact]
    public async Task HealthEndpoint_StillWorks_WithFullDataLayerWired()
    {
        var client = _fixture.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }
}
