using System.ComponentModel.DataAnnotations;
using SchedulingApi.Entities;

namespace SchedulingApi.Dtos;

public class CreateDoctorAppointmentRequest
{
    [Required]
    public Guid ConsultantDoctorId { get; set; }

    [Required]
    public Guid ChildId { get; set; }

    [Required]
    public DateOnly? AppointmentDate { get; set; }

    [Required]
    public TimeOnly? AppointmentTime { get; set; }
}

public class UpdateDoctorAppointmentRequest
{
    [Required]
    public DateOnly? AppointmentDate { get; set; }

    [Required]
    public TimeOnly? AppointmentTime { get; set; }
}

public class DoctorAppointmentResponse
{
    public Guid Id { get; set; }
    public Guid ConsultantDoctorId { get; set; }
    public Guid ConsultantClinicId { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public Guid ChildId { get; set; }
    public DateOnly AppointmentDate { get; set; }
    public TimeOnly AppointmentTime { get; set; }
    public decimal ConsultationFee { get; set; }
    public AppointmentStatus Status { get; set; }
}
