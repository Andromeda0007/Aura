"""Departments (branches within a Batch). Admin-managed; creating one auto-spawns
Semesters 1–8."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.access import accessible_batch_ids, accessible_department_ids, is_admin
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.hierarchy import department_session_ids
from app.models.batch import Batch
from app.models.command import Command
from app.models.course import Course
from app.models.department import Department
from app.models.semester import Semester
from app.models.semester_member import SemesterMember
from app.models.session import Session
from app.models.unit import Unit
from app.models.user import User
from app.routers.stats import aggregate_stats
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate, SemesterOut

router = APIRouter(prefix="/departments", tags=["departments"])

DEFAULT_SEMESTERS = 8


def _dept_or_404(department_id: uuid.UUID, db: DBSession) -> Department:
    dept = db.get(Department, department_id)
    if dept is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department not found")
    return dept


def _assert_dept_visible(db: DBSession, user: User, dept: Department) -> None:
    allowed = accessible_department_ids(db, user)
    if allowed is not None and dept.id not in allowed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department not found")


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    body: DepartmentCreate, db: DBSession = Depends(get_db), _: User = Depends(require_admin)
) -> DepartmentOut:
    if db.get(Batch, body.batch_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Batch not found")
    if db.scalar(
        select(Department).where(
            Department.batch_id == body.batch_id,
            func.lower(Department.name) == body.name.strip().lower(),
        )
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, f'A department named "{body.name}" already exists in this batch')
    dept = Department(batch_id=body.batch_id, name=body.name, color=body.color)
    db.add(dept)
    db.flush()
    for n in range(1, DEFAULT_SEMESTERS + 1):  # auto-create Sem 1–8
        db.add(Semester(department_id=dept.id, number=n))
    db.commit()
    db.refresh(dept)
    return DepartmentOut.model_validate(dept)


@router.get("")
def list_departments(
    batch_id: uuid.UUID = Query(...),
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    # batch must be visible
    allowed_batches = accessible_batch_ids(db, user)
    if allowed_batches is not None and batch_id not in allowed_batches:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Batch not found")
    depts = list(
        db.scalars(
            select(Department).where(Department.batch_id == batch_id).order_by(Department.name)
        ).all()
    )
    allowed_depts = accessible_department_ids(db, user)
    if allowed_depts is not None:
        depts = [d for d in depts if d.id in allowed_depts]
    dept_ids = [d.id for d in depts] or [uuid.uuid4()]
    sem_counts = dict(
        db.execute(
            select(Semester.department_id, func.count())
            .where(Semester.department_id.in_(dept_ids))
            .group_by(Semester.department_id)
        ).all()
    )
    course_counts = dict(
        db.execute(
            select(Semester.department_id, func.count(Course.id))
            .join(Course, Course.semester_id == Semester.id)
            .where(Semester.department_id.in_(dept_ids))
            .group_by(Semester.department_id)
        ).all()
    )
    token_sums = dict(
        db.execute(
            select(Semester.department_id, func.coalesce(func.sum(Command.tokens_used), 0))
            .select_from(Semester)
            .join(Course, Course.semester_id == Semester.id)
            .join(Unit, Unit.course_id == Course.id)
            .join(Session, Session.unit_id == Unit.id)
            .join(Command, Command.session_id == Session.id)
            .where(Semester.department_id.in_(dept_ids))
            .group_by(Semester.department_id)
        ).all()
    )
    return [
        {
            **DepartmentOut.model_validate(d).model_dump(mode="json"),
            "semesters": sem_counts.get(d.id, 0),
            "courses": course_counts.get(d.id, 0),
            "tokensUsed": int(token_sums.get(d.id, 0)),
        }
        for d in depts
    ]


@router.get("/{department_id}")
def get_department(
    department_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    dept = _dept_or_404(department_id, db)
    _assert_dept_visible(db, user, dept)
    semesters = list(
        db.scalars(
            select(Semester).where(Semester.department_id == dept.id).order_by(Semester.number)
        ).all()
    )
    # students/teachers only see the semesters they're a member of within the dept
    if not is_admin(user):
        member = set(
            db.scalars(select(SemesterMember.semester_id).where(SemesterMember.user_id == user.id)).all()
        )
        semesters = [s for s in semesters if s.id in member]
    return {
        "department": DepartmentOut.model_validate(dept).model_dump(mode="json"),
        "semesters": [SemesterOut.model_validate(s).model_dump(mode="json") for s in semesters],
    }


@router.patch("/{department_id}", response_model=DepartmentOut)
def update_department(
    department_id: uuid.UUID,
    body: DepartmentUpdate,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> DepartmentOut:
    dept = _dept_or_404(department_id, db)
    data = body.model_dump(exclude_unset=True)
    if data.get("name") and db.scalar(
        select(Department).where(
            Department.batch_id == dept.batch_id,
            func.lower(Department.name) == data["name"].strip().lower(),
            Department.id != dept.id,
        )
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, f'A department named "{data["name"]}" already exists in this batch')
    for key, value in data.items():
        setattr(dept, key, value)
    db.commit()
    db.refresh(dept)
    return DepartmentOut.model_validate(dept)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_department(
    department_id: uuid.UUID, db: DBSession = Depends(get_db), _: User = Depends(require_admin)
) -> Response:
    dept = _dept_or_404(department_id, db)
    db.delete(dept)  # cascades semesters -> courses -> ...
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{department_id}/stats")
def department_stats(
    department_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    dept = _dept_or_404(department_id, db)
    _assert_dept_visible(db, user, dept)
    return aggregate_stats(db, department_session_ids(db, department_id))
