using System.ComponentModel.DataAnnotations;

namespace DirectoryApi.Dtos;

public class CreateHolidayRequest
{
    [Required]
    public Guid BranchId { get; set; }

    [Required]
    public DateOnly? Date { get; set; }

    [Required, MaxLength(500)]
    public required string Reason { get; set; }
}

public class HolidayResponse
{
    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public DateOnly Date { get; set; }
    public required string Reason { get; set; }
}

public class IsClosedResponse
{
    public bool IsClosed { get; set; }
}
