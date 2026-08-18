from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.directory_client import DirectoryApiClient
from app.clients.scheduling_client import SchedulingApiClient
from app.config import settings
from app.db import get_db
from app.models import SlotSuggestionLog
from app.ranking import rank_candidates
from app.schemas import SuggestionsResponse
from app.tenancy import get_tenant_id

router = APIRouter()


@router.get("/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(
    child_id: UUID = Query(alias="childId"),
    branch_id: UUID = Query(alias="branchId"),
    therapy_type_id: UUID = Query(alias="therapyTypeId"),
    requested_date: date = Query(alias="date"),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> SuggestionsResponse:
    directory_client = DirectoryApiClient(settings.directory_api_base_url)
    scheduling_client = SchedulingApiClient(settings.scheduling_api_base_url)

    therapists = await directory_client.get_active_therapists(branch_id, therapy_type_id, tenant_id)

    availability_by_therapist: dict[str, list[int]] = {}
    for therapist in therapists:
        windows = await scheduling_client.get_availability(
            branch_id, therapist.id, therapy_type_id, requested_date, tenant_id
        )
        if windows:
            availability_by_therapist[str(therapist.id)] = windows

    suggestions = rank_candidates(therapists, availability_by_therapist, str(branch_id), str(therapy_type_id))

    log_entry = SlotSuggestionLog(
        tenant_id=UUID(tenant_id),
        child_id=child_id,
        branch_id=branch_id,
        therapy_type_id=therapy_type_id,
        requested_date=requested_date,
        suggestions=[item.model_dump(mode="json", by_alias=True) for item in suggestions],
        created_at=datetime.now(timezone.utc),
    )
    db.add(log_entry)
    await db.commit()

    return SuggestionsResponse(suggestions=suggestions, generated_at=datetime.now(timezone.utc))
