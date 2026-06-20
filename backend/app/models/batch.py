"""Batch model — a cohort's term (e.g. Computer Science, Sem 5, 2026).

Top of the academic hierarchy: Batch -> Course -> Unit -> Session. Stored as
structured fields so the title composes itself and a new batch is created each
year for the new intake.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    program: Mapped[str] = mapped_column(String(120), nullable=False)  # e.g. "Computer Science"
    semester: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 5
    year: Mapped[int] = mapped_column(Integer, nullable=False)  # intake/academic year, e.g. 2026
    section: Mapped[str | None] = mapped_column(String(40), nullable=True)
    roster: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # [{"name": str}]
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
