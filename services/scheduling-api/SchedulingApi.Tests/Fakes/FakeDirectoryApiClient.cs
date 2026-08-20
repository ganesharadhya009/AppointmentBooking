using SchedulingApi.Clients;

namespace SchedulingApi.Tests.Fakes;

public class FakeDirectoryApiClient : IDirectoryApiClient
{
    public BranchInfo? BranchToReturn { get; set; }
    public TherapistInfo? TherapistToReturn { get; set; }
    public bool? IsBranchClosedToReturn { get; set; }
    public bool? IsTherapistOnLeaveToReturn { get; set; }
    public ConsultantDoctorInfo? ConsultantDoctorToReturn { get; set; }
    public int? ActiveLeaveCountToReturn { get; set; }

    public Task<BranchInfo?> GetBranchAsync(Guid branchId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(BranchToReturn);

    public Task<TherapistInfo?> GetTherapistAsync(Guid therapistId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(TherapistToReturn);

    public Task<bool?> IsBranchClosedAsync(Guid branchId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(IsBranchClosedToReturn);

    public Task<bool?> IsTherapistOnLeaveAsync(Guid therapistId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(IsTherapistOnLeaveToReturn);

    public Task<ConsultantDoctorInfo?> GetConsultantDoctorAsync(Guid consultantDoctorId, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(ConsultantDoctorToReturn);

    public Task<int?> GetActiveLeaveCountAsync(DateOnly date, Guid tenantId, CancellationToken cancellationToken = default)
        => Task.FromResult(ActiveLeaveCountToReturn);
}
