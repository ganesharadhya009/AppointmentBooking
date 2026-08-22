namespace DirectoryApi.Entities;

public class ConsultantDoctorSessionWindow
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ConsultantDoctorId { get; set; }
    public SessionWindowName WindowName { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal PricePerSession { get; set; }
}
