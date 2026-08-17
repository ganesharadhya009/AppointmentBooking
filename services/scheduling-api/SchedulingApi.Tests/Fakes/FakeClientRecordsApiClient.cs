using SchedulingApi.Clients;

namespace SchedulingApi.Tests.Fakes;

public class FakeClientRecordsApiClient : IClientRecordsApiClient
{
    public ChildInfo? ChildToReturn { get; set; }

    public Task<ChildInfo?> GetChildAsync(Guid childId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(ChildToReturn);
}
