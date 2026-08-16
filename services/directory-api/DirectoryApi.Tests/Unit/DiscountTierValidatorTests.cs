using DirectoryApi.Dtos;
using DirectoryApi.Validation;
using Xunit;

namespace DirectoryApi.Tests.Unit;

public class DiscountTierValidatorTests
{
    private static List<DiscountTierDto> ValidTiers() =>
    [
        new() { SessionCount = 10, DiscountPerSession = 50 },
        new() { SessionCount = 24, DiscountPerSession = 100 },
        new() { SessionCount = 48, DiscountPerSession = 150 },
        new() { SessionCount = 72, DiscountPerSession = 200 },
        new() { SessionCount = 96, DiscountPerSession = 250 }
    ];

    [Fact]
    public void IsValid_ReturnsTrue_ForExactlyTheFiveRequiredTiers()
    {
        var result = DiscountTierValidator.IsValid(ValidTiers(), out var error);

        Assert.True(result);
        Assert.Null(error);
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenATierIsMissing()
    {
        var tiers = ValidTiers();
        tiers.RemoveAt(0);

        var result = DiscountTierValidator.IsValid(tiers, out var error);

        Assert.False(result);
        Assert.NotNull(error);
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenASessionCountIsDuplicated()
    {
        var tiers = ValidTiers();
        tiers[1].SessionCount = 10;

        var result = DiscountTierValidator.IsValid(tiers, out var error);

        Assert.False(result);
        Assert.NotNull(error);
    }

    [Fact]
    public void IsValid_ReturnsFalse_WhenASessionCountIsWrong()
    {
        var tiers = ValidTiers();
        tiers[0].SessionCount = 11;

        var result = DiscountTierValidator.IsValid(tiers, out var error);

        Assert.False(result);
        Assert.NotNull(error);
    }
}
