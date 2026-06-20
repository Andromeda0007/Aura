"""Courses (subjects within a Batch). Hold Units; sessions live under Units."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.core.hierarchy import course_session_ids
from app.models.batch import Batch
from app.models.command import Command
from app.models.course import Course
from app.models.enums import CommandStatus
from app.models.session import Session
from app.models.unit import Unit
from app.models.user import User
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate
from app.schemas.unit import UnitOut
from app.routers.stats import aggregate_stats

router = APIRouter(prefix="/courses", tags=["courses"])


def _owned_batch(batch_id: uuid.UUID, db: DBSession, teacher: User) -> Batch:
    batch = db.get(Batch, batch_id)
    if batch is None or batch.teacher_id != teacher.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Batch not found")
    return batch


def _owned_course(course_id: uuid.UUID, db: DBSession, teacher: User) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.teacher_id != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your course")
    return course


def _counts(db: DBSession, course_id: uuid.UUID) -> dict:
    sids = course_session_ids(db, course_id)
    tokens = items = 0
    if sids:
        tokens = db.scalar(
            select(func.coalesce(func.sum(Command.tokens_used), 0)).where(Command.session_id.in_(sids))
        ) or 0
        items = db.scalar(
            select(func.count())
            .select_from(Command)
            .where(Command.session_id.in_(sids), Command.status == CommandStatus.COMPLETED)
        ) or 0
    return {"sessions": len(sids), "tokensUsed": int(tokens), "items": int(items)}


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    body: CourseCreate, db: DBSession = Depends(get_db), teacher: User = Depends(get_current_teacher)
) -> CourseOut:
    _owned_batch(body.batch_id, db, teacher)
    course = Course(
        teacher_id=teacher.id,
        batch_id=body.batch_id,
        name=body.name,
        professor=body.professor,
        cover=body.cover,
        color=body.color,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return CourseOut.model_validate(course)


@router.get("")
def list_courses(
    batch_id: uuid.UUID = Query(...),
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> list[dict]:
    _owned_batch(batch_id, db, teacher)
    courses = list(
        db.scalars(
            select(Course)
            .where(Course.batch_id == batch_id)
            .order_by(Course.created_at.desc())
        ).all()
    )
    unit_counts = dict(
        db.execute(
            select(Unit.course_id, func.count())
            .where(Unit.course_id.in_([c.id for c in courses] or [uuid.uuid4()]))
            .group_by(Unit.course_id)
        ).all()
    )
    return [
        {
            **CourseOut.model_validate(c).model_dump(mode="json"),
            "units": unit_counts.get(c.id, 0),
            **_counts(db, c.id),
        }
        for c in courses
    ]


@router.get("/{course_id}")
def get_course(
    course_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> dict:
    course = _owned_course(course_id, db, teacher)
    units = list(
        db.scalars(
            select(Unit).where(Unit.course_id == course.id).order_by(Unit.order, Unit.created_at)
        ).all()
    )
    session_counts = dict(
        db.execute(
            select(Session.unit_id, func.count())
            .where(Session.unit_id.in_([u.id for u in units] or [uuid.uuid4()]))
            .group_by(Session.unit_id)
        ).all()
    )
    return {
        "course": CourseOut.model_validate(course).model_dump(mode="json"),
        "counts": _counts(db, course.id),
        "units": [
            {**UnitOut.model_validate(u).model_dump(mode="json"), "sessions": session_counts.get(u.id, 0)}
            for u in units
        ],
    }


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: uuid.UUID,
    body: CourseUpdate,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> CourseOut:
    course = _owned_course(course_id, db, teacher)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(course, key, value)
    db.commit()
    db.refresh(course)
    return CourseOut.model_validate(course)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_course(
    course_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> Response:
    course = _owned_course(course_id, db, teacher)
    db.delete(course)  # cascades to units -> sessions
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{course_id}/stats")
def course_stats(
    course_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> dict:
    _owned_course(course_id, db, teacher)
    return aggregate_stats(db, course_session_ids(db, course_id))
