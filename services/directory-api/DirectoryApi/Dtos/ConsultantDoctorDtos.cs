using System.ComponentModel.DataAnnotations;
using DirectoryApi.Entities;

namespace DirectoryApi.Dtos;

public class CreateConsultantDoctorRequest
{
    [Required, MaxLength(200)]
    public required string Name { get; set; }

    [Required]
    public Guid? ConsultantServiceId { get; set; }

    [Required]
    public Guid? ConsultantClinicId { get; set; }

    [Required]
    public decimal? ConsultationFee { get; set; }
}

public class UpdateConsultantDoctorRequest : CreateConsultantDoctorRequest
{
    [Required]
    public ConsultantStatus? Status { get; set; }
}

public class ConsultantDoctorResponse
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public Guid ConsultantClinicId { get; set; }
    public decimal ConsultationFee { get; set; }
    public ConsultantStatus Status { get; set; }
}
