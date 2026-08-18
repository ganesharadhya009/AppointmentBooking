import uuid

from app.ranking import rank_candidates
from app.schemas import AssignmentInfo, SessionWindowInfo, TherapistInfo


def _therapist(therapist_id, branch_id, therapy_type_id, windows) -> TherapistInfo:
    return TherapistInfo(
        id=therapist_id,
        status=0,
        assignments=[
            AssignmentInfo(
                branch_id=branch_id,
                therapy_type_id=therapy_type_id,
                session_windows=windows,
            )
        ],
    )


def test_rank_candidates_orders_by_earliest_start_time() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    early_therapist_id = uuid.uuid4()
    late_therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            late_therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=2, start_time="14:00:00", end_time="16:00:00", price_per_session=600.0)],
        ),
        _therapist(
            early_therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0)],
        ),
    ]
    availability = {str(late_therapist_id): [2], str(early_therapist_id): [0]}

    result = rank_candidates(therapists, availability, str(branch_id), str(therapy_type_id))

    assert len(result) == 2
    assert result[0].therapist_id == early_therapist_id
    assert result[1].therapist_id == late_therapist_id


def test_rank_candidates_tie_breaks_by_lowest_price() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    cheaper_therapist_id = uuid.uuid4()
    pricier_therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            pricier_therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=700.0)],
        ),
        _therapist(
            cheaper_therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0)],
        ),
    ]
    availability = {str(pricier_therapist_id): [0], str(cheaper_therapist_id): [0]}

    result = rank_candidates(therapists, availability, str(branch_id), str(therapy_type_id))

    assert result[0].therapist_id == cheaper_therapist_id
    assert result[1].therapist_id == pricier_therapist_id


def test_rank_candidates_excludes_therapist_with_no_availability_entry() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            therapist_id,
            branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0)],
        )
    ]

    result = rank_candidates(therapists, {}, str(branch_id), str(therapy_type_id))

    assert result == []


def test_rank_candidates_excludes_window_not_in_available_windows() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            therapist_id,
            branch_id,
            therapy_type_id,
            [
                SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0),
                SessionWindowInfo(window_name=2, start_time="14:00:00", end_time="16:00:00", price_per_session=600.0),
            ],
        )
    ]
    availability = {str(therapist_id): [2]}

    result = rank_candidates(therapists, availability, str(branch_id), str(therapy_type_id))

    assert len(result) == 1
    assert result[0].window_name == 2


def test_rank_candidates_excludes_therapist_without_a_matching_assignment() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    other_branch_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    therapists = [
        _therapist(
            therapist_id,
            other_branch_id,
            therapy_type_id,
            [SessionWindowInfo(window_name=0, start_time="09:00:00", end_time="12:00:00", price_per_session=500.0)],
        )
    ]
    availability = {str(therapist_id): [0]}

    result = rank_candidates(therapists, availability, str(branch_id), str(therapy_type_id))

    assert result == []
