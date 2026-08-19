using System.ComponentModel.DataAnnotations;
using SchedulingApi.Entities;

namespace SchedulingApi.Dtos;

public class CreateRefundRequestRequest
{
    [Required]
    public RefundRequestAppointmentType? AppointmentType { get; set; }

    [Required]
    public Guid AppointmentId { get; set; }

    [Required]
    public decimal? Amount { get; set; }
}

public class RefundRequestResponse
{
    public Guid Id { get; set; }
    public RefundRequestAppointmentType AppointmentType { get; set; }
    public Guid AppointmentId { get; set; }
    public decimal Amount { get; set; }
    public RefundRequestStatus Status { get; set; }
    public string? ApprovedBy { get; set; }
}
