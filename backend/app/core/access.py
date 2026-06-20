"""RBAC access helpers — resolve a user's SEMESTER scope and gate read/write.

Tree: Batch -> Department -> Semester -> Course -> Unit -> Session.
Membership lives at the Semester (`SemesterMember`). Roles: ADMIN (all, rw),
TEACHER (assigned semesters, rw), STUDENT (assigned semester, read-only).
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models.course import Course
from app.models.department import Department
from app.models.enums import UserRole
from app.models.semester import Semester
from app.models.semester_member import SemesterMember
from app.models.session import Session
from app.models.unit import Unit
from app.models.user import User


def is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN


def member_semester_ids(db: DBSession, user: User) -> list[uuid.UUID]:
    return list(
        db.scalars(select(SemesterMember.semester_id).where(SemesterMember.user_id == user.id)).all()
    )


def accessible_session_ids(db: DBSession, user: User) -> list[uuid.UUID]:
    """Leaf session ids the user may see (for scoped stats/library)."""
    q = select(Session.id)
    if not is_admin(user):
        sem_ids = member_semester_ids(db, user)
        if not sem_ids:
            return []
        q = (
            q.join(Unit, Session.unit_id == Unit.id)
            .join(Course, Unit.course_id == Course.id)
            .where(Course.semester_id.in_(sem_ids))
        )
    return list(db.scalars(q).all())


def assert_semester_access(
    db: DBSession, user: User, semester_id: uuid.UUID | None, write: bool = False
) -> None:
    """Raise unless the user may read (or write) this semester."""
    if is_admin(user):
        return
    if semester_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    member = db.scalar(
        select(SemesterMember).where(
            SemesterMember.semester_id == semester_id, SemesterMember.user_id == user.id
        )
    )
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if write and user.role == UserRole.STUDENT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Read-only access")


# ---- resolve the owning semester / department / batch of any entity ----
def semester_of_course(db: DBSession, course_id: uuid.UUID) -> uuid.UUID | None:
    course = db.get(Course, course_id)
    return course.semester_id if course else None


def semester_of_unit(db: DBSession, unit_id: uuid.UUID) -> uuid.UUID | None:
    unit = db.get(Unit, unit_id)
    return semester_of_course(db, unit.course_id) if unit else None


def semester_of_session(db: DBSession, session_id: uuid.UUID) -> uuid.UUID | None:
    sess = db.get(Session, session_id)
    if sess is None or sess.unit_id is None:
        return None
    return semester_of_unit(db, sess.unit_id)


def department_of_semester(db: DBSession, semester_id: uuid.UUID) -> uuid.UUID | None:
    sem = db.get(Semester, semester_id)
    return sem.department_id if sem else None


def batch_of_department(db: DBSession, department_id: uuid.UUID) -> uuid.UUID | None:
    dept = db.get(Department, department_id)
    return dept.batch_id if dept else None


def accessible_batch_ids(db: DBSession, user: User) -> list[uuid.UUID] | None:
    """Batches the user may see = batches containing a semester they're a member of.
    None = unrestricted (admin)."""
    if is_admin(user):
        return None
    sem_ids = member_semester_ids(db, user)
    if not sem_ids:
        return []
    rows = db.execute(
        select(Department.batch_id)
        .join(Semester, Semester.department_id == Department.id)
        .where(Semester.id.in_(sem_ids))
    ).all()
    return list({r[0] for r in rows})


def accessible_department_ids(db: DBSession, user: User) -> list[uuid.UUID] | None:
    """Departments containing a member semester. None = admin (all)."""
    if is_admin(user):
        return None
    sem_ids = member_semester_ids(db, user)
    if not sem_ids:
        return []
    rows = db.execute(
        select(Semester.department_id).where(Semester.id.in_(sem_ids))
    ).all()
    return list({r[0] for r in rows})
