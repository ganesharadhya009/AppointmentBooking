using SchedulingApi.Clients;

namespace SchedulingApi.Tests.Fakes;

public class FakeDirectoryApiClient : IDirectoryApiClient
{
    public BranchInfo? BranchToReturn { get; set; }
    public TherapistInfo? TherapistToReturn { get; set; }

    public Task<BranchInfo?> GetBranchAsync(Guid branchId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(BranchToReturn);

    public Task<TherapistInfo?> GetTherapistAsync(Guid therapistId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(TherapistToReturn);
}
