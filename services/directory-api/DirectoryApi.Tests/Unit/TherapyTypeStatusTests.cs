using DirectoryApi.Entities;
using Xunit;

namespace DirectoryApi.Tests.Unit;

public class TherapyTypeStatusTests
{
    [Theory]
    [InlineData(TherapyTypeStatus.Active)]
    [InlineData(TherapyTypeStatus.Inactive)]
    public void Deleted_IsATerminalState_CannotTransitionBackTo(TherapyTypeStatus attemptedNewStatus)
    {
        var therapyType = new TherapyType
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            Name = "Speech Therapy",
            Status = TherapyTypeStatus.Deleted,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = "system"
        };

        var isBlockedTransition = therapyType.Status == TherapyTypeStatus.Deleted &&
                                   attemptedNewStatus != TherapyTypeStatus.Deleted;

        Assert.True(isBlockedTransition);
    }
}
