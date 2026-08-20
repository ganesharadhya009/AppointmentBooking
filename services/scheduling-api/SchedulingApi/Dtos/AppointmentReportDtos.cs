using SchedulingApi.Entities;

namespace SchedulingApi.Dtos;

public enum AppointmentKind
{
    Therapist,
    Doctor
}

public class UnifiedAppointmentResponse
{
    public Guid Id { get; set; }
    public AppointmentKind Kind { get; set; }
    public Guid ChildId { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public decimal Amount { get; set; }
    public AppointmentStatus Status { get; set; }

    // Therapist-only (null when Kind == Doctor)
    public Guid? BranchId { get; set; }
    public Guid? TherapistId { get; set; }
    public Guid? TherapyTypeId { get; set; }

    // Doctor-only (null when Kind == Therapist)
    public Guid? ConsultantDoctorId { get; set; }
    public Guid? ConsultantClinicId { get; set; }
}

public class ChildCancellationSummary
{
    public Guid ChildId { get; set; }
    public int CancellationCount { get; set; }
}
