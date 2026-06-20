"""RBAC access helpers — resolve a user's batch scope and gate read/write.

Roles: ADMIN (all batches, rw), TEACHER (assigned batches, rw), STUDENT
(assigned batch(es), read-only). Membership lives in BatchMember; admins are
implicit (no rows).
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models.batch_member import BatchMember
from app.models.course import Course
from app.models.enums import UserRole
from app.models.session import Session
from app.models.unit import Unit
from app.models.user import User


def is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN


def member_batch_ids(db: DBSession, user: User) -> list[uuid.UUID]:
    return list(
        db.scalars(select(BatchMember.batch_id).where(BatchMember.user_id == user.id)).all()
    )


def accessible_batch_ids(db: DBSession, user: User) -> list[uuid.UUID] | None:
    """Batch ids the user may see. None = unrestricted (admin)."""
    if is_admin(user):
        return None
    return member_batch_ids(db, user)


def accessible_session_ids(db: DBSession, user: User) -> list[uuid.UUID]:
    """Leaf session ids the user may see (for scoped stats/library)."""
    q = select(Session.id)
    if not is_admin(user):
        ids = member_batch_ids(db, user)
        if not ids:
            return []
        q = (
            q.join(Unit, Session.unit_id == Unit.id)
            .join(Course, Unit.course_id == Course.id)
            .where(Course.batch_id.in_(ids))
        )
    return list(db.scalars(q).all())


def assert_batch_access(db: DBSession, user: User, batch_id: uuid.UUID, write: bool = False) -> None:
    """Raise unless the user may read (or write) this batch."""
    if is_admin(user):
        return
    member = db.scalar(
        select(BatchMember).where(
            BatchMember.batch_id == batch_id, BatchMember.user_id == user.id
        )
    )
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if write and user.role == UserRole.STUDENT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Read-only access")


# ---- resolve the owning batch of any hierarchy entity ----
def batch_of_course(db: DBSession, course_id: uuid.UUID) -> uuid.UUID | None:
    course = db.get(Course, course_id)
    return course.batch_id if course else None


def batch_of_unit(db: DBSession, unit_id: uuid.UUID) -> uuid.UUID | None:
    unit = db.get(Unit, unit_id)
    return batch_of_course(db, unit.course_id) if unit else None


def batch_of_session(db: DBSession, session_id: uuid.UUID) -> uuid.UUID | None:
    sess = db.get(Session, session_id)
    if sess is None or sess.unit_id is None:
        return None
    return batch_of_unit(db, sess.unit_id)
