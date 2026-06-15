"""WhiteboardLog model — one captured board snapshot + its OCR text.

Image bytes are stored in Postgres (base64 text) at demo scale; swap to an
object-store URL behind a storage interface if this ever needs to scale.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WhiteboardLog(Base):
    __tablename__ = "whiteboard_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tldraw_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    image_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # base64 PNG
    ocr_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    page_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
