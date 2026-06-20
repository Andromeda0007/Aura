"""Units (chapters within a Course)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.core.access import assert_batch_access, batch_of_unit
from app.core.database import get_db
from app.core.deps import get_current_user, require_staff
from app.core.hierarchy import unit_session_ids
from app.models.course import Course
from app.models.session import Session
from app.models.unit import Unit
from app.models.user import User
from app.schemas.session import SessionOut
from app.schemas.unit import UnitCreate, UnitOut, UnitUpdate
from app.routers.stats import aggregate_stats

router = APIRouter(prefix="/units", tags=["units"])


def _unit_or_404(unit_id: uuid.UUID, db: DBSession) -> Unit:
    unit = db.get(Unit, unit_id)
    if unit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unit not found")
    return unit


@router.post("", response_model=UnitOut, status_code=status.HTTP_201_CREATED)
def create_unit(
    body: UnitCreate, db: DBSession = Depends(get_db), user: User = Depends(require_staff)
) -> UnitOut:
    course = db.get(Course, body.course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    assert_batch_access(db, user, course.batch_id, write=True)
    unit = Unit(course_id=body.course_id, name=body.name, description=body.description, order=body.order)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return UnitOut.model_validate(unit)


@router.get("/{unit_id}")
def get_unit(
    unit_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    unit = _unit_or_404(unit_id, db)
    assert_batch_access(db, user, batch_of_unit(db, unit_id))
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
    user: User = Depends(require_staff),
) -> UnitOut:
    unit = _unit_or_404(unit_id, db)
    assert_batch_access(db, user, batch_of_unit(db, unit_id), write=True)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(unit, key, value)
    db.commit()
    db.refresh(unit)
    return UnitOut.model_validate(unit)


@router.delete("/{unit_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_unit(
    unit_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(require_staff),
) -> Response:
    unit = _unit_or_404(unit_id, db)
    assert_batch_access(db, user, batch_of_unit(db, unit_id), write=True)
    db.delete(unit)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{unit_id}/stats")
def unit_stats(
    unit_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    _unit_or_404(unit_id, db)
    assert_batch_access(db, user, batch_of_unit(db, unit_id))
    return aggregate_stats(db, unit_session_ids(db, unit_id))
