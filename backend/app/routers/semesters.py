"""Semesters (Sem 1–8). The membership unit / classroom hub — holds Courses."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.access import assert_semester_access, member_semester_ids
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.hierarchy import course_session_ids, semester_session_ids
from app.models.batch import Batch
from app.models.command import Command
from app.models.course import Course
from app.models.department import Department
from app.models.enums import CommandStatus
from app.models.semester import Semester
from app.models.semester_member import SemesterMember
from app.models.unit import Unit
from app.models.user import User
from app.schemas.course import CourseOut
from app.schemas.department import DepartmentOut, SemesterOut
from app.routers.stats import aggregate_stats

router = APIRouter(prefix="/semesters", tags=["semesters"])


def _sem_or_404(semester_id: uuid.UUID, db: DBSession) -> Semester:
    sem = db.get(Semester, semester_id)
    if sem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Semester not found")
    return sem


@router.post("", response_model=SemesterOut, status_code=status.HTTP_201_CREATED)
def create_semester(
    department_id: uuid.UUID,
    number: int,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> SemesterOut:
    if db.get(Department, department_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department not found")
    sem = Semester(department_id=department_id, number=number)
    db.add(sem)
    db.commit()
    db.refresh(sem)
    return SemesterOut.model_validate(sem)


@router.get("/mine")
def my_semesters(
    db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    """The semesters a teacher/student is assigned to (for the login class picker)."""
    sem_ids = member_semester_ids(db, user)
    if not sem_ids:
        return []
    rows = db.execute(
        select(Semester, Department)
        .join(Department, Semester.department_id == Department.id)
        .where(Semester.id.in_(sem_ids))
        .order_by(Department.name, Semester.number)
    ).all()
    out = []
    for sem, dept in rows:
        batch = db.get(Batch, dept.batch_id)
        out.append(
            {
                "id": str(sem.id),
                "number": sem.number,
                "department": dept.name,
                "batch": f"{batch.start_year}-{batch.end_year}" if batch else "",
            }
        )
    return out


@router.get("/{semester_id}")
def get_semester(
    semester_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    sem = _sem_or_404(semester_id, db)
    assert_semester_access(db, user, semester_id)
    dept = db.get(Department, sem.department_id)
    courses = list(
        db.scalars(
            select(Course).where(Course.semester_id == sem.id).order_by(func.lower(Course.name).asc())
        ).all()
    )
    unit_counts = dict(
        db.execute(
            select(Unit.course_id, func.count())
            .where(Unit.course_id.in_([c.id for c in courses] or [uuid.uuid4()]))
            .group_by(Unit.course_id)
        ).all()
    )

    def counts(cid: uuid.UUID) -> dict:
        sids = course_session_ids(db, cid)
        tokens = items = 0
        if sids:
            tokens = db.scalar(
                select(func.coalesce(func.sum(Command.tokens_used), 0)).where(Command.session_id.in_(sids))
            ) or 0
            items = db.scalar(
                select(func.count()).select_from(Command).where(
                    Command.session_id.in_(sids), Command.status == CommandStatus.COMPLETED
                )
            ) or 0
        return {"sessions": len(sids), "tokensUsed": int(tokens), "items": int(items)}

    return {
        "semester": SemesterOut.model_validate(sem).model_dump(mode="json"),
        "department": DepartmentOut.model_validate(dept).model_dump(mode="json") if dept else None,
        "courses": [
            {
                **CourseOut.model_validate(c).model_dump(mode="json"),
                "units": unit_counts.get(c.id, 0),
                **counts(c.id),
            }
            for c in courses
        ],
    }


@router.delete("/{semester_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_semester(
    semester_id: uuid.UUID, db: DBSession = Depends(get_db), _: User = Depends(require_admin)
) -> Response:
    sem = _sem_or_404(semester_id, db)
    db.delete(sem)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{semester_id}/stats")
def semester_stats(
    semester_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    _sem_or_404(semester_id, db)
    assert_semester_access(db, user, semester_id)
    return aggregate_stats(db, semester_session_ids(db, semester_id))
