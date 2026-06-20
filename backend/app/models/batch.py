"""Batch model — an admission cohort by years (e.g. 2022–2026).

Top of the academic tree: Batch -> Department -> Semester -> Course -> Unit ->
Session. Created/owned by an admin; teachers/students get access via Semester
membership, not this row.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    start_year: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 2022
    end_year: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 2026
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
