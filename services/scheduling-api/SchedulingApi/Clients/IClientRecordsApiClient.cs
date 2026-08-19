namespace SchedulingApi.Clients;

public enum RemoteClientStatus
{
    Active,
    Inactive
}

public class ChildInfo
{
    public Guid Id { get; set; }
    public Guid ParentId { get; set; }
    public RemoteClientStatus Status { get; set; }
}

public interface IClientRecordsApiClient
{
    Task<ChildInfo?> GetChildAsync(Guid childId, Guid tenantId, CancellationToken cancellationToken = default);
}
