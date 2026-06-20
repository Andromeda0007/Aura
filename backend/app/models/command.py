"""Command model — one user command + its classified intent and LLM response."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import CommandIntent, CommandStatus


class Command(Base):
    __tablename__ = "commands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    raw_command: Mapped[str] = mapped_column(Text, nullable=False)
    intent: Mapped[CommandIntent] = mapped_column(
        SAEnum(CommandIntent, name="command_intent"), default=CommandIntent.OTHER, nullable=False
    )
    llm_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[CommandStatus] = mapped_column(
        SAEnum(CommandStatus, name="command_status"), default=CommandStatus.PENDING, nullable=False
    )
    processing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # real LLM usage
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
