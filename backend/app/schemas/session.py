"""Session request/response schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SessionStatus


class SessionCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=200)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID
    subject: str
    status: SessionStatus
    active_buffer_tokens: int
    start_time: datetime
    end_time: datetime | None
    created_at: datetime
