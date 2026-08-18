namespace DirectoryApi.Entities;

public class ConsultantDoctor
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public Guid ConsultantServiceId { get; set; }
    public Guid ConsultantClinicId { get; set; }
    public decimal ConsultationFee { get; set; }
    public ConsultantStatus Status { get; set; } = ConsultantStatus.Active;
}
