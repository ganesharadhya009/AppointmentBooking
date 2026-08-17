namespace SchedulingApi.Entities;

public enum SessionWindowName
{
    Morning,
    Noon,
    Afternoon,
    Evening
}

public enum AppointmentStatus
{
    Planned,
    Completed,
    Cancelled
}

public class Appointment
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid TherapistId { get; set; }
    public Guid TherapyTypeId { get; set; }
    public Guid ChildId { get; set; }
    public SessionWindowName WindowName { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal PricePerSession { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Planned;
    public required string IdempotencyKey { get; set; }
    public required string BookedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
