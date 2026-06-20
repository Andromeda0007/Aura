"""Courses: a teacher groups sessions into a class and keeps an optional roster."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.models.course import Course
from app.models.session import Session
from app.models.user import User
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate
from app.schemas.session import SessionOut

router = APIRouter(prefix="/courses", tags=["courses"])


def _owned_course(course_id: uuid.UUID, db: DBSession, teacher: User) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    if course.teacher_id != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your course")
    return course


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    body: CourseCreate, db: DBSession = Depends(get_db), teacher: User = Depends(get_current_teacher)
) -> CourseOut:
    course = Course(teacher_id=teacher.id, name=body.name, color=body.color, roster=[])
    db.add(course)
    db.commit()
    db.refresh(course)
    return CourseOut.model_validate(course)


@router.get("")
def list_courses(
    db: DBSession = Depends(get_db), teacher: User = Depends(get_current_teacher)
) -> list[dict]:
    rows = db.execute(
        select(Course, func.count(Session.id))
        .outerjoin(Session, Session.course_id == Course.id)
        .where(Course.teacher_id == teacher.id)
        .group_by(Course.id)
        .order_by(Course.created_at.desc())
    ).all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "color": c.color,
            "students": len(c.roster or []),
            "sessions": sessions,
            "createdAt": c.created_at.isoformat() if c.created_at else None,
        }
        for c, sessions in rows
    ]


@router.get("/{course_id}")
def get_course(
    course_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> dict:
    course = _owned_course(course_id, db, teacher)
    sessions = db.scalars(
        select(Session).where(Session.course_id == course.id).order_by(Session.created_at.desc())
    ).all()
    return {
        "course": CourseOut.model_validate(course).model_dump(mode="json"),
        "sessions": [SessionOut.model_validate(s).model_dump(mode="json") for s in sessions],
    }


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: uuid.UUID,
    body: CourseUpdate,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> CourseOut:
    course = _owned_course(course_id, db, teacher)
    if body.name is not None:
        course.name = body.name
    if body.color is not None:
        course.color = body.color
    if body.roster is not None:
        course.roster = [r.model_dump() for r in body.roster]
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
    db.delete(course)  # sessions.course_id -> NULL via FK ondelete
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
