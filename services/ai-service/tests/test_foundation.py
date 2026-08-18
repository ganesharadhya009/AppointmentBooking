import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import pytest

from app.models import SlotSuggestionLog
from app.tenancy import get_tenant_id


async def test_can_insert_and_query_a_slot_suggestion_log(db_session: AsyncSession) -> None:
    log_entry = SlotSuggestionLog(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        child_id=uuid.uuid4(),
        branch_id=uuid.uuid4(),
        therapy_type_id=uuid.uuid4(),
        requested_date=date(2026, 9, 1),
        suggestions=[{"therapistId": str(uuid.uuid4()), "score": 540.0}],
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(log_entry)
    await db_session.commit()

    result = await db_session.execute(select(SlotSuggestionLog).where(SlotSuggestionLog.id == log_entry.id))
    found = result.scalar_one()

    assert found.tenant_id == log_entry.tenant_id
    assert found.suggestions[0]["score"] == 540.0


def test_health_endpoint_still_works(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["service"] == "AiService"


def test_get_tenant_id_rejects_missing_header() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_tenant_id(x_tenant_id=None)

    assert exc_info.value.status_code == 400


def test_get_tenant_id_rejects_malformed_header() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_tenant_id(x_tenant_id="not-a-guid")

    assert exc_info.value.status_code == 400


def test_get_tenant_id_accepts_a_valid_guid() -> None:
    tenant_id = str(uuid.uuid4())

    result = get_tenant_id(x_tenant_id=tenant_id)

    assert result == tenant_id
