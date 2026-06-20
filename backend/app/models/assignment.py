"""Assignment + submission models — homework a teacher assigns (optionally a quiz)
with a due date, completed by students via a public share code."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def generate_share_code() -> str:
    return secrets.token_urlsafe(6)


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), index=True, nullable=True
    )
    quiz_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    instructions: Mapped[str] = mapped_column(Text, default="", nullable=False)
    share_code: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, default=generate_share_code, nullable=False
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    student_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
