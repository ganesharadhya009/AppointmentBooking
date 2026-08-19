using System.ComponentModel.DataAnnotations;

namespace BillingApi.Validation;

public static class DataAnnotationsValidator
{
    public static Dictionary<string, string[]>? Validate(object request)
    {
        var context = new ValidationContext(request);
        var results = new List<ValidationResult>();

        if (Validator.TryValidateObject(request, context, results, validateAllProperties: true))
        {
            return null;
        }

        return results
            .SelectMany(r => r.MemberNames.DefaultIfEmpty(""), (r, member) => (member, r.ErrorMessage))
            .GroupBy(x => x.member)
            .ToDictionary(g => g.Key, g => g.Select(x => x.ErrorMessage ?? "Invalid value.").ToArray());
    }
}
