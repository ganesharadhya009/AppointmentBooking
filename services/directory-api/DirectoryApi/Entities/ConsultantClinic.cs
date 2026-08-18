namespace DirectoryApi.Entities;

public class ConsultantClinic
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? LeadContactName { get; set; }
    public string? LeadContactPhone { get; set; }
    public ConsultantStatus Status { get; set; } = ConsultantStatus.Active;
}
