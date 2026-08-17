using System.ComponentModel.DataAnnotations;
using SchedulingApi.Clients;
using SchedulingApi.Entities;

namespace SchedulingApi.Dtos;

public class AvailabilityResponse
{
    public required List<Clients.SessionWindowName> AvailableWindows { get; set; }
}

public class CreateAppointmentRequest
{
    [Required]
    public Guid BranchId { get; set; }

    [Required]
    public Guid TherapistId { get; set; }

    [Required]
    public Guid TherapyTypeId { get; set; }

    [Required]
    public Guid ChildId { get; set; }

    [Required]
    public Entities.SessionWindowName? WindowName { get; set; }

    [Required]
    public DateOnly? AppointmentDate { get; set; }
}

public class AppointmentResponse
{
    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public Guid TherapistId { get; set; }
    public Guid TherapyTypeId { get; set; }
    public Guid ChildId { get; set; }
    public Entities.SessionWindowName WindowName { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal PricePerSession { get; set; }
    public AppointmentStatus Status { get; set; }
}
