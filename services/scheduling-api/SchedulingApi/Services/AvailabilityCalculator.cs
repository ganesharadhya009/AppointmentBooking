using SchedulingApi.Clients;
using SchedulingApi.Entities;

namespace SchedulingApi.Services;

public static class AvailabilityCalculator
{
    public static List<Clients.SessionWindowName> ComputeAvailableWindows(
        TherapistAssignmentInfo assignment,
        List<Appointment> existingAppointments)
    {
        var bookedWindows = existingAppointments
            .Where(a => a.Status != AppointmentStatus.Cancelled)
            .Select(a => (Clients.SessionWindowName)(int)a.WindowName)
            .ToHashSet();

        return assignment.SessionWindows
            .Select(w => w.WindowName)
            .Where(w => !bookedWindows.Contains(w))
            .ToList();
    }
}
