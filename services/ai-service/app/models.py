import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, JSON, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SlotSuggestionLog(Base):
    __tablename__ = "slot_suggestion_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True, nullable=False)
    child_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    branch_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    therapy_type_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    requested_date: Mapped[date] = mapped_column(Date, nullable=False)
    suggestions: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
