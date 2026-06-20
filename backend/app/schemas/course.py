"""Course request/response schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RosterEntry(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    color: str = Field(default="indigo", max_length=20)


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    color: str | None = Field(default=None, max_length=20)
    roster: list[RosterEntry] | None = None


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str
    roster: list[RosterEntry]
    created_at: datetime
