from datetime import date
from uuid import UUID

import httpx

from app.schemas import AvailabilityResponse


class SchedulingApiClient:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    async def get_availability(
        self,
        branch_id: UUID,
        therapist_id: UUID,
        therapy_type_id: UUID,
        requested_date: date,
        tenant_id: str,
    ) -> list[int]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(
                    f"{self._base_url}/availability",
                    params={
                        "branchId": str(branch_id),
                        "therapistId": str(therapist_id),
                        "therapyTypeId": str(therapy_type_id),
                        "date": requested_date.isoformat(),
                    },
                    headers={"X-Tenant-Id": tenant_id},
                )
            except httpx.HTTPError:
                return []
        if response.status_code != 200:
            return []
        return AvailabilityResponse.model_validate(response.json()).available_windows
