using DirectoryApi.Dtos;

namespace DirectoryApi.Validation;

public static class ConsultantDoctorValidator
{
    public static bool IsValid(List<ConsultantSessionWindowDto> sessionWindows, out string? error)
    {
        if (sessionWindows.Count > 4)
        {
            error = "A doctor can have at most 4 session windows (Morning, Noon, Afternoon, Evening).";
            return false;
        }

        var windowNames = sessionWindows.Select(w => w.WindowName).ToList();
        if (windowNames.Distinct().Count() != windowNames.Count)
        {
            error = "Each session window name (Morning, Noon, Afternoon, Evening) can appear at most once.";
            return false;
        }

        foreach (var window in sessionWindows)
        {
            if (window.EndTime <= window.StartTime)
            {
                error = "A session window's end time must be after its start time.";
                return false;
            }
        }

        error = null;
        return true;
    }
}
