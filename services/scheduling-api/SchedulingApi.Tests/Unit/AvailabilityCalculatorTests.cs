using SchedulingApi.Clients;
using SchedulingApi.Entities;
using SchedulingApi.Services;
using Xunit;

namespace SchedulingApi.Tests.Unit;

public class AvailabilityCalculatorTests
{
    private static TherapistAssignmentInfo AssignmentWithAllFourWindows()
    {
        var branchId = Guid.NewGuid();
        var therapyTypeId = Guid.NewGuid();
        return new TherapistAssignmentInfo
        {
            BranchId = branchId,
            TherapyTypeId = therapyTypeId,
            SessionWindows =
            [
                new() { WindowName = Clients.SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 },
                new() { WindowName = Clients.SessionWindowName.Afternoon, StartTime = new TimeOnly(14, 0), EndTime = new TimeOnly(16, 0), PricePerSession = 500 }
            ]
        };
    }

    [Fact]
    public void ComputeAvailableWindows_ReturnsAllWindows_WhenNoAppointmentsExist()
    {
        var result = AvailabilityCalculator.ComputeAvailableWindows(AssignmentWithAllFourWindows(), []);

        Assert.Equal(2, result.Count);
        Assert.Contains(Clients.SessionWindowName.Morning, result);
        Assert.Contains(Clients.SessionWindowName.Afternoon, result);
    }

    [Fact]
    public void ComputeAvailableWindows_ExcludesABookedWindow()
    {
        var assignment = AssignmentWithAllFourWindows();
        var bookedAppointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            BranchId = assignment.BranchId,
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = assignment.TherapyTypeId,
            ChildId = Guid.NewGuid(),
            WindowName = Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1),
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(12, 0),
            PricePerSession = 500,
            Status = AppointmentStatus.Planned,
            IdempotencyKey = Guid.NewGuid().ToString(),
            BookedBy = "system",
            CreatedAt = DateTimeOffset.UtcNow
        };

        var result = AvailabilityCalculator.ComputeAvailableWindows(assignment, [bookedAppointment]);

        Assert.DoesNotContain(Clients.SessionWindowName.Morning, result);
        Assert.Contains(Clients.SessionWindowName.Afternoon, result);
    }

    [Fact]
    public void ComputeAvailableWindows_ACancelledAppointmentsWindowStaysAvailable()
    {
        var assignment = AssignmentWithAllFourWindows();
        var cancelledAppointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            BranchId = assignment.BranchId,
            TherapistId = Guid.NewGuid(),
            TherapyTypeId = assignment.TherapyTypeId,
            ChildId = Guid.NewGuid(),
            WindowName = Entities.SessionWindowName.Morning,
            AppointmentDate = new DateOnly(2026, 9, 1),
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(12, 0),
            PricePerSession = 500,
            Status = AppointmentStatus.Cancelled,
            IdempotencyKey = Guid.NewGuid().ToString(),
            BookedBy = "system",
            CreatedAt = DateTimeOffset.UtcNow
        };

        var result = AvailabilityCalculator.ComputeAvailableWindows(assignment, [cancelledAppointment]);

        Assert.Contains(Clients.SessionWindowName.Morning, result);
    }
}
