from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SessionWindowInfo(CamelModel):
    window_name: int
    start_time: str
    end_time: str
    price_per_session: float


class AssignmentInfo(CamelModel):
    branch_id: UUID
    therapy_type_id: UUID
    session_windows: list[SessionWindowInfo]


class TherapistInfo(CamelModel):
    id: UUID
    status: int
    assignments: list[AssignmentInfo]


class TherapistsPage(CamelModel):
    items: list[TherapistInfo]


class AvailabilityResponse(CamelModel):
    available_windows: list[int]


class SuggestionItem(CamelModel):
    therapist_id: UUID
    window_name: int
    start_time: str
    end_time: str
    price_per_session: float
    score: float


class SuggestionsResponse(CamelModel):
    suggestions: list[SuggestionItem]
    generated_at: datetime
