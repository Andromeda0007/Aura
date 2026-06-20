"""Units (chapters within a Course)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.core.hierarchy import unit_session_ids
from app.models.command import Command
from app.models.course import Course
from app.models.session import Session
from app.models.unit import Unit
from app.models.user import User
from app.schemas.session import SessionOut
from app.schemas.unit import UnitCreate, UnitOut, UnitUpdate
from app.routers.stats import aggregate_stats

router = APIRouter(prefix="/units", tags=["units"])


def _owned_course(course_id: uuid.UUID, db: DBSession, teacher: User) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.teacher_id != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your course")
    return course


def _owned_unit(unit_id: uuid.UUID, db: DBSession, teacher: User) -> Unit:
    unit = db.get(Unit, unit_id)
    if unit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unit not found")
    _owned_course(unit.course_id, db, teacher)
    return unit


@router.post("", response_model=UnitOut, status_code=status.HTTP_201_CREATED)
def create_unit(
    body: UnitCreate, db: DBSession = Depends(get_db), teacher: User = Depends(get_current_teacher)
) -> UnitOut:
    _owned_course(body.course_id, db, teacher)
    unit = Unit(course_id=body.course_id, name=body.name, description=body.description, order=body.order)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return UnitOut.model_validate(unit)


@router.get("/{unit_id}")
def get_unit(
    unit_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> dict:
    unit = _owned_unit(unit_id, db, teacher)
    sessions = db.scalars(
        select(Session).where(Session.unit_id == unit.id).order_by(Session.created_at.desc())
    ).all()
    return {
        "unit": UnitOut.model_validate(unit).model_dump(mode="json"),
        "sessions": [SessionOut.model_validate(s).model_dump(mode="json") for s in sessions],
    }


@router.patch("/{unit_id}", response_model=UnitOut)
def update_unit(
    unit_id: uuid.UUID,
    body: UnitUpdate,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> UnitOut:
    unit = _owned_unit(unit_id, db, teacher)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(unit, key, value)
    db.commit()
    db.refresh(unit)
    return UnitOut.model_validate(unit)


@router.delete("/{unit_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_unit(
    unit_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> Response:
    unit = _owned_unit(unit_id, db, teacher)
    db.delete(unit)  # cascades to its sessions
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{unit_id}/stats")
def unit_stats(
    unit_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> dict:
    _owned_unit(unit_id, db, teacher)
    return aggregate_stats(db, unit_session_ids(db, unit_id))
