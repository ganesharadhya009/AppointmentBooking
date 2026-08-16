using DirectoryApi.Dtos;
using DirectoryApi.Entities;
using DirectoryApi.Validation;
using Xunit;

namespace DirectoryApi.Tests.Unit;

public class TherapistValidatorTests
{
    private static AssignmentDto ValidAssignment() => new()
    {
        BranchId = Guid.NewGuid(),
        TherapyTypeId = Guid.NewGuid(),
        JoiningDate = new DateOnly(2026, 1, 1),
        WeeklyDayOff = DayOfWeek.Sunday,
        SessionWindows =
        [
            new SessionWindowDto { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(12, 0), PricePerSession = 500 }
        ]
    };

    [Fact]
    public void IsValid_ReturnsTrue_ForOneValidAssignment()
    {
        var result = TherapistValidator.IsValid([ValidAssignment()], out var error);

        Assert.True(result);
        Assert.Null(error);
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenNoAssignments()
    {
        var result = TherapistValidator.IsValid([], out var error);

        Assert.False(result);
        Assert.NotNull(error);
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenAnAssignmentHasNoSessionWindows()
    {
        var assignment = ValidAssignment();
        assignment.SessionWindows = [];

        var result = TherapistValidator.IsValid([assignment], out var error);

        Assert.False(result);
        Assert.NotNull(error);
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenAnAssignmentHasMoreThanFourSessionWindows()
    {
        var assignment = ValidAssignment();
        assignment.SessionWindows =
        [
            new SessionWindowDto { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(6, 0), EndTime = new TimeOnly(7, 0), PricePerSession = 100 },
            new SessionWindowDto { WindowName = SessionWindowName.Noon, StartTime = new TimeOnly(12, 0), EndTime = new TimeOnly(13, 0), PricePerSession = 100 },
            new SessionWindowDto { WindowName = SessionWindowName.Afternoon, StartTime = new TimeOnly(14, 0), EndTime = new TimeOnly(15, 0), PricePerSession = 100 },
            new SessionWindowDto { WindowName = SessionWindowName.Evening, StartTime = new TimeOnly(18, 0), EndTime = new TimeOnly(19, 0), PricePerSession = 100 },
            new SessionWindowDto { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(8, 0), PricePerSession = 100 }
        ];

        var result = TherapistValidator.IsValid([assignment], out var error);

        Assert.False(result);
        Assert.NotNull(error);
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenASessionWindowNameIsDuplicated()
    {
        var assignment = ValidAssignment();
        assignment.SessionWindows =
        [
            new SessionWindowDto { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(6, 0), EndTime = new TimeOnly(7, 0), PricePerSession = 100 },
            new SessionWindowDto { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(9, 0), PricePerSession = 100 }
        ];

        var result = TherapistValidator.IsValid([assignment], out var error);

        Assert.False(result);
        Assert.NotNull(error);
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenASessionWindowEndTimeIsNotAfterStartTime()
    {
        var assignment = ValidAssignment();
        assignment.SessionWindows =
        [
            new SessionWindowDto { WindowName = SessionWindowName.Morning, StartTime = new TimeOnly(12, 0), EndTime = new TimeOnly(9, 0), PricePerSession = 100 }
        ];

        var result = TherapistValidator.IsValid([assignment], out var error);

        Assert.False(result);
        Assert.NotNull(error);
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenSessionWindowsIsNull()
    {
        var assignment = ValidAssignment();
        assignment.SessionWindows = null!;

        var result = TherapistValidator.IsValid([assignment], out var error);

        Assert.False(result);
        Assert.NotNull(error);
    }
}
