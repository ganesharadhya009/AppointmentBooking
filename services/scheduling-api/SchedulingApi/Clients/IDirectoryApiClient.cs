namespace SchedulingApi.Clients;

public enum RemoteStatus
{
    Active,
    Inactive,
    Deleted
}

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

public class TherapyTypeInfo
{
    public Guid Id { get; set; }
    public RemoteStatus Status { get; set; }
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
    Task<TherapyTypeInfo?> GetTherapyTypeAsync(Guid therapyTypeId, Guid tenantId, CancellationToken cancellationToken = default);
}
