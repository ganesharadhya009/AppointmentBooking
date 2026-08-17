using SchedulingApi.Clients;

namespace SchedulingApi.Dtos;

public class AvailabilityResponse
{
    public required List<SessionWindowName> AvailableWindows { get; set; }
}
