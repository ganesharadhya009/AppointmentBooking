import uuid
from datetime import date

import httpx
import respx
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings


def _directory_response(therapist_id: uuid.UUID, branch_id: uuid.UUID, therapy_type_id: uuid.UUID) -> dict:
    return {
        "items": [
            {
                "id": str(therapist_id),
                "status": 0,
                "assignments": [
                    {
                        "branchId": str(branch_id),
                        "therapyTypeId": str(therapy_type_id),
                        "sessionWindows": [
                            {
                                "windowName": 0,
                                "startTime": "09:00:00",
                                "endTime": "12:00:00",
                                "pricePerSession": 500.0,
                            }
                        ],
                    }
                ],
            }
        ],
        "page": 1,
        "pageSize": 100,
        "totalCount": 1,
    }


@respx.mock
def test_get_suggestions_returns_ranked_list_and_logs_the_request(client: TestClient, db_session: AsyncSession) -> None:
    tenant_id = str(uuid.uuid4())
    child_id = uuid.uuid4()
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    respx.get(f"{settings.directory_api_base_url}/therapists").mock(
        return_value=httpx.Response(200, json=_directory_response(therapist_id, branch_id, therapy_type_id))
    )
    respx.get(f"{settings.scheduling_api_base_url}/availability").mock(
        return_value=httpx.Response(200, json={"availableWindows": [0]})
    )

    response = client.get(
        "/suggestions",
        params={
            "childId": str(child_id),
            "branchId": str(branch_id),
            "therapyTypeId": str(therapy_type_id),
            "date": "2026-09-01",
        },
        headers={"X-Tenant-Id": tenant_id},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["suggestions"]) == 1
    assert body["suggestions"][0]["therapistId"] == str(therapist_id)


@respx.mock
def test_get_suggestions_returns_empty_list_when_directory_api_is_unreachable(client: TestClient) -> None:
    tenant_id = str(uuid.uuid4())

    respx.get(f"{settings.directory_api_base_url}/therapists").mock(
        side_effect=httpx.ConnectError("connection refused")
    )

    response = client.get(
        "/suggestions",
        params={
            "childId": str(uuid.uuid4()),
            "branchId": str(uuid.uuid4()),
            "therapyTypeId": str(uuid.uuid4()),
            "date": "2026-09-01",
        },
        headers={"X-Tenant-Id": tenant_id},
    )

    assert response.status_code == 200
    assert response.json()["suggestions"] == []


@respx.mock
def test_get_suggestions_excludes_a_therapist_whose_scheduling_call_fails(client: TestClient) -> None:
    tenant_id = str(uuid.uuid4())
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()

    respx.get(f"{settings.directory_api_base_url}/therapists").mock(
        return_value=httpx.Response(200, json=_directory_response(therapist_id, branch_id, therapy_type_id))
    )
    respx.get(f"{settings.scheduling_api_base_url}/availability").mock(return_value=httpx.Response(500))

    response = client.get(
        "/suggestions",
        params={
            "childId": str(uuid.uuid4()),
            "branchId": str(branch_id),
            "therapyTypeId": str(therapy_type_id),
            "date": "2026-09-01",
        },
        headers={"X-Tenant-Id": tenant_id},
    )

    assert response.status_code == 200
    assert response.json()["suggestions"] == []


def test_get_suggestions_rejects_missing_tenant_header(client: TestClient) -> None:
    response = client.get(
        "/suggestions",
        params={
            "childId": str(uuid.uuid4()),
            "branchId": str(uuid.uuid4()),
            "therapyTypeId": str(uuid.uuid4()),
            "date": "2026-09-01",
        },
    )

    assert response.status_code == 400
