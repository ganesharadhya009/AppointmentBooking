namespace SchedulingApi.Entities;

public enum RefundRequestAppointmentType
{
    TherapistAppointment,
    DoctorAppointment
}

public enum RefundRequestStatus
{
    Pending,
    Approved,
    Rejected
}

public class RefundRequest
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public RefundRequestAppointmentType AppointmentType { get; set; }
    public Guid AppointmentId { get; set; }
    public decimal Amount { get; set; }
    public RefundRequestStatus Status { get; set; } = RefundRequestStatus.Pending;
    public string? ApprovedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
