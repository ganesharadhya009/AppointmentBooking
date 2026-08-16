namespace DirectoryApi.Entities;

public enum SessionWindowName
{
    Morning,
    Noon,
    Afternoon,
    Evening
}

public class TherapistSessionWindow
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid AssignmentId { get; set; }
    public SessionWindowName WindowName { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal PricePerSession { get; set; }
}
