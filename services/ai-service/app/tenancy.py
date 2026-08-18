from uuid import UUID

from fastapi import Header, HTTPException, status


def get_tenant_id(x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id")) -> str:
    if not x_tenant_id or not x_tenant_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing or invalid X-Tenant-Id header",
        )
    try:
        UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing or invalid X-Tenant-Id header",
        ) from None
    return x_tenant_id
