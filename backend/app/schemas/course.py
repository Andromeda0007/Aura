"""Course request/response schemas."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
    batch_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    professor: str = Field(default="", max_length=160)
    cover: str = Field(default="", max_length=40)  # preset art key
    color: str = Field(default="indigo", max_length=20)
    start_date: date | None = None
    end_date: date | None = None


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    professor: str | None = Field(default=None, max_length=160)
    cover: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=20)
    start_date: date | None = None
    end_date: date | None = None


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_id: uuid.UUID
    name: str
    professor: str
    cover: str
    color: str
    start_date: date | None
    end_date: date | None
    created_at: datetime
