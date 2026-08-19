namespace SchedulingApi.Entities;

public class DoctorAppointment
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ConsultantDoctorId { get; set; }
    public Guid ConsultantClinicId { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public Guid ChildId { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly AppointmentTime { get; set; }
    public decimal ConsultationFee { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Planned;
    public required string IdempotencyKey { get; set; }
    public required string BookedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
