from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.clients.client_records_client import ClientRecordsApiClient
from app.config import settings
from app.schemas import EnquiryTriageResponse
from app.tenancy import get_tenant_id
from app.triage import rank_enquiries

router = APIRouter()


@router.get("/enquiry-triage", response_model=EnquiryTriageResponse)
async def get_enquiry_triage(tenant_id: str = Depends(get_tenant_id)) -> EnquiryTriageResponse:
    client = ClientRecordsApiClient(settings.client_records_api_base_url)
    enquiries = await client.get_submitted_enquiries(tenant_id)
    items = rank_enquiries(enquiries)
    return EnquiryTriageResponse(items=items, generated_at=datetime.now(timezone.utc))
