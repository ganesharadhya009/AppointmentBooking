using DirectoryApi.Dtos;

namespace DirectoryApi.Validation;

public static class DiscountTierValidator
{
    private static readonly int[] RequiredSessionCounts = [10, 24, 48, 72, 96];

    public static bool IsValid(List<DiscountTierDto> tiers, out string? error)
    {
        if (tiers is null)
        {
            error = "Discount tiers are required.";
            return false;
        }

        var sessionCounts = tiers.Select(t => t.SessionCount).OrderBy(c => c).ToArray();

        if (!sessionCounts.SequenceEqual(RequiredSessionCounts))
        {
            error = "A branch must have exactly one discount tier for each of the session counts 10, 24, 48, 72, and 96.";
            return false;
        }

        error = null;
        return true;
    }
}
