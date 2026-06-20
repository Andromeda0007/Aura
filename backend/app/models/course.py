"""Course model — a teacher's class that groups sessions and an optional roster.

Roster is a lightweight JSONB list of {"name": str} labels (this product has no
student accounts), used to tag attendance / live-quiz players, not to authenticate.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="indigo", nullable=False)
    roster: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # [{"name": str}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
