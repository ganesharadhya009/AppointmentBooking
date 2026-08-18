namespace SchedulingApi.Clients;

public enum RemoteStatus
{
    Active,
    Inactive,
    Deleted
}

// Member order is load-bearing: cast by integer value to/from the paired SessionWindowName in the other namespace. Do not reorder.
public enum SessionWindowName
{
    Morning,
    Noon,
    Afternoon,
    Evening
}

public class BranchInfo
{
    public Guid Id { get; set; }
    public bool IsActive { get; set; }
}

public class IsClosedResponse
{
    public bool IsClosed { get; set; }
}

public class SessionWindowInfo
{
    public SessionWindowName WindowName { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal PricePerSession { get; set; }
}

public class TherapistAssignmentInfo
{
    public Guid BranchId { get; set; }
    public Guid TherapyTypeId { get; set; }
    public List<SessionWindowInfo> SessionWindows { get; set; } = [];
}

public class TherapistInfo
{
    public Guid Id { get; set; }
    public RemoteStatus Status { get; set; }
    public List<TherapistAssignmentInfo> Assignments { get; set; } = [];
}

public interface IDirectoryApiClient
{
    Task<BranchInfo?> GetBranchAsync(Guid branchId, Guid tenantId, CancellationToken cancellationToken = default);
    Task<TherapistInfo?> GetTherapistAsync(Guid therapistId, Guid tenantId, CancellationToken cancellationToken = default);
    Task<bool?> IsBranchClosedAsync(Guid branchId, DateOnly date, Guid tenantId, CancellationToken cancellationToken = default);
}
