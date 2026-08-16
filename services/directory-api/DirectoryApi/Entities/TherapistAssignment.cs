namespace DirectoryApi.Entities;

public class TherapistAssignment
{
    public Guid Id { get; set; }
    public Guid TherapistId { get; set; }
    public Guid BranchId { get; set; }
    public Guid TherapyTypeId { get; set; }
    public DateOnly JoiningDate { get; set; }
    public DayOfWeek WeeklyDayOff { get; set; }
    public TimeOnly? LunchBreakStart { get; set; }
    public TimeOnly? LunchBreakEnd { get; set; }

    public List<TherapistSessionWindow> SessionWindows { get; set; } = [];
}
