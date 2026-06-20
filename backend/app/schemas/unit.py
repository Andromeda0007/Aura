"""Unit request/response schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UnitCreate(BaseModel):
    course_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    order: int = Field(default=0, ge=0, le=1000)


class UnitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    order: int | None = Field(default=None, ge=0, le=1000)


class UnitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    course_id: uuid.UUID
    name: str
    description: str
    order: int
    created_at: datetime
