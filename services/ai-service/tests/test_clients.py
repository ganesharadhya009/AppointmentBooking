import uuid
from datetime import date

import httpx
import respx

from app.clients.directory_client import DirectoryApiClient
from app.clients.scheduling_client import SchedulingApiClient


@respx.mock
async def test_get_active_therapists_parses_camel_case_response() -> None:
    branch_id = uuid.uuid4()
    therapy_type_id = uuid.uuid4()
    therapist_id = uuid.uuid4()
    respx.get("http://directory.test/therapists").mock(
        return_value=httpx.Response(
            200,
            json={
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
            },
        )
    )

    client = DirectoryApiClient("http://directory.test")
    result = await client.get_active_therapists(branch_id, therapy_type_id, str(uuid.uuid4()))

    assert len(result) == 1
    assert result[0].id == therapist_id
    assert result[0].assignments[0].session_windows[0].price_per_session == 500.0


@respx.mock
async def test_get_active_therapists_returns_empty_list_on_non_200() -> None:
    respx.get("http://directory.test/therapists").mock(return_value=httpx.Response(500))

    client = DirectoryApiClient("http://directory.test")
    result = await client.get_active_therapists(uuid.uuid4(), uuid.uuid4(), str(uuid.uuid4()))

    assert result == []


@respx.mock
async def test_get_active_therapists_returns_empty_list_on_connection_error() -> None:
    respx.get("http://directory.test/therapists").mock(side_effect=httpx.ConnectError("connection refused"))

    client = DirectoryApiClient("http://directory.test")
    result = await client.get_active_therapists(uuid.uuid4(), uuid.uuid4(), str(uuid.uuid4()))

    assert result == []


@respx.mock
async def test_get_availability_parses_available_windows() -> None:
    respx.get("http://scheduling.test/availability").mock(
        return_value=httpx.Response(200, json={"availableWindows": [0, 2]})
    )

    client = SchedulingApiClient("http://scheduling.test")
    result = await client.get_availability(
        uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), date(2026, 9, 1), str(uuid.uuid4())
    )

    assert result == [0, 2]


@respx.mock
async def test_get_availability_returns_empty_list_on_404() -> None:
    respx.get("http://scheduling.test/availability").mock(return_value=httpx.Response(404))

    client = SchedulingApiClient("http://scheduling.test")
    result = await client.get_availability(
        uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), date(2026, 9, 1), str(uuid.uuid4())
    )

    assert result == []
