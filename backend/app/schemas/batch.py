"""Batch (cohort/term) request/response schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RosterEntry(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class BatchCreate(BaseModel):
    program: str = Field(min_length=1, max_length=120)
    semester: int = Field(ge=1, le=20)
    year: int = Field(ge=2000, le=2100)
    section: str | None = Field(default=None, max_length=40)


class BatchUpdate(BaseModel):
    program: str | None = Field(default=None, min_length=1, max_length=120)
    semester: int | None = Field(default=None, ge=1, le=20)
    year: int | None = Field(default=None, ge=2000, le=2100)
    section: str | None = Field(default=None, max_length=40)
    roster: list[RosterEntry] | None = None
    archived: bool | None = None


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    program: str
    semester: int
    year: int
    section: str | None
    roster: list[RosterEntry]
    archived: bool
    created_at: datetime
