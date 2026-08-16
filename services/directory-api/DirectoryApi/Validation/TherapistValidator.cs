using DirectoryApi.Dtos;

namespace DirectoryApi.Validation;

public static class TherapistValidator
{
    public static bool IsValid(List<AssignmentDto> assignments, out string? error)
    {
        if (assignments.Count == 0)
        {
            error = "A therapist must have at least one assignment.";
            return false;
        }

        foreach (var assignment in assignments)
        {
            if (assignment.SessionWindows.Count == 0 || assignment.SessionWindows.Count > 4)
            {
                error = "Each assignment must have between 1 and 4 session windows.";
                return false;
            }

            var windowNames = assignment.SessionWindows.Select(w => w.WindowName).ToList();
            if (windowNames.Distinct().Count() != windowNames.Count)
            {
                error = "Each session window name (Morning, Noon, Afternoon, Evening) can appear at most once per assignment.";
                return false;
            }

            foreach (var window in assignment.SessionWindows)
            {
                if (window.EndTime <= window.StartTime)
                {
                    error = "A session window's end time must be after its start time.";
                    return false;
                }
            }
        }

        error = null;
        return true;
    }
}
