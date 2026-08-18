from uuid import UUID

import httpx

from app.schemas import TherapistInfo, TherapistsPage


class DirectoryApiClient:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    async def get_active_therapists(
        self, branch_id: UUID, therapy_type_id: UUID, tenant_id: str
    ) -> list[TherapistInfo]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(
                    f"{self._base_url}/therapists",
                    params={
                        "branchId": str(branch_id),
                        "therapyTypeId": str(therapy_type_id),
                        "status": "Active",
                        "pageSize": 100,
                    },
                    headers={"X-Tenant-Id": tenant_id},
                )
            except httpx.HTTPError:
                return []
        if response.status_code != 200:
            return []
        page = TherapistsPage.model_validate(response.json())
        return page.items
