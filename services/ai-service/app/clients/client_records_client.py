import httpx

from app.schemas import EnquiriesPage, EnquiryInfo


class ClientRecordsApiClient:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    async def get_submitted_enquiries(self, tenant_id: str) -> list[EnquiryInfo]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(
                    f"{self._base_url}/enquiries",
                    params={"status": "Submitted", "pageSize": 100},
                    headers={"X-Tenant-Id": tenant_id},
                )
            except httpx.HTTPError:
                return []
        if response.status_code != 200:
            return []
        page = EnquiriesPage.model_validate(response.json())
        return page.items
