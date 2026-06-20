"""Batch (admission cohort) request/response schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BatchCreate(BaseModel):
    start_year: int = Field(ge=2000, le=2100)
    end_year: int = Field(ge=2000, le=2100)


class BatchUpdate(BaseModel):
    start_year: int | None = Field(default=None, ge=2000, le=2100)
    end_year: int | None = Field(default=None, ge=2000, le=2100)
    archived: bool | None = None


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    start_year: int
    end_year: int
    archived: bool
    created_at: datetime
