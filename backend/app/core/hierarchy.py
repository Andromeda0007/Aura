"""Resolve the leaf sessions under any hierarchy level (Batch/Course/Unit).

Chain: Session.unit_id -> Unit.course_id -> Course.batch_id. Used by scoped
stats and card counts (token sums, etc.).
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models.course import Course
from app.models.session import Session
from app.models.unit import Unit


def unit_session_ids(db: DBSession, unit_id: uuid.UUID) -> list[uuid.UUID]:
    return list(db.scalars(select(Session.id).where(Session.unit_id == unit_id)).all())


def course_session_ids(db: DBSession, course_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        db.scalars(
            select(Session.id)
            .join(Unit, Session.unit_id == Unit.id)
            .where(Unit.course_id == course_id)
        ).all()
    )


def batch_session_ids(db: DBSession, batch_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        db.scalars(
            select(Session.id)
            .join(Unit, Session.unit_id == Unit.id)
            .join(Course, Unit.course_id == Course.id)
            .where(Course.batch_id == batch_id)
        ).all()
    )
