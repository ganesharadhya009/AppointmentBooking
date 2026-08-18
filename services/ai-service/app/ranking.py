from app.schemas import AssignmentInfo, SuggestionItem, TherapistInfo


def _minutes_since_midnight(time_str: str) -> int:
    hour, minute = (int(part) for part in time_str.split(":")[:2])
    return hour * 60 + minute


def _find_assignment(therapist: TherapistInfo, branch_id: str, therapy_type_id: str) -> AssignmentInfo | None:
    for assignment in therapist.assignments:
        if str(assignment.branch_id) == branch_id and str(assignment.therapy_type_id) == therapy_type_id:
            return assignment
    return None


def rank_candidates(
    therapists: list[TherapistInfo],
    availability_by_therapist: dict[str, list[int]],
    branch_id: str,
    therapy_type_id: str,
) -> list[SuggestionItem]:
    """Pure function: combine each therapist's assignment (matching the
    given branch/therapy type) with their available session windows
    (from availability_by_therapist, keyed by therapist id as a string),
    and return a flat list of suggestions sorted by earliest start time,
    tie-broken by lowest price.
    """
    scored: list[tuple[int, float, SuggestionItem]] = []

    for therapist in therapists:
        available_windows = availability_by_therapist.get(str(therapist.id))
        if not available_windows:
            continue

        assignment = _find_assignment(therapist, branch_id, therapy_type_id)
        if assignment is None:
            continue

        for window in assignment.session_windows:
            if window.window_name not in available_windows:
                continue

            minutes = _minutes_since_midnight(window.start_time)
            item = SuggestionItem(
                therapist_id=therapist.id,
                window_name=window.window_name,
                start_time=window.start_time,
                end_time=window.end_time,
                price_per_session=window.price_per_session,
                score=float(minutes),
            )
            scored.append((minutes, window.price_per_session, item))

    scored.sort(key=lambda entry: (entry[0], entry[1]))
    return [item for _, _, item in scored]
