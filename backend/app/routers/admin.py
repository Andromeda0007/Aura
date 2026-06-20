"""Admin-only: manage teacher/student/admin accounts + cross-batch stats."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.access import accessible_session_ids  # noqa: F401  (kept for parity)
from app.core.database import get_db
from app.core.deps import require_admin
from app.core.hierarchy import batch_session_ids
from app.core.security import hash_password
from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.command import Command
from app.models.course import Course
from app.models.enums import UserRole
from app.models.quiz import Quiz
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    batch_ids: list[uuid.UUID] = Field(default_factory=list)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool | None = None
    role: UserRole | None = None
    batch_ids: list[uuid.UUID] | None = None


def _active_admin_count(db: DBSession) -> int:
    return db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == UserRole.ADMIN, User.is_active.is_(True))
    ) or 0


def _set_memberships(db: DBSession, user: User, batch_ids: list[uuid.UUID]) -> None:
    db.query(BatchMember).filter(BatchMember.user_id == user.id).delete()
    for bid in dict.fromkeys(batch_ids):  # de-dupe, preserve order
        if db.get(Batch, bid) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Batch {bid} not found")
        db.add(BatchMember(batch_id=bid, user_id=user.id))


def _user_dict(db: DBSession, user: User) -> dict:
    batch_ids = [
        str(b)
        for b in db.scalars(
            select(BatchMember.batch_id).where(BatchMember.user_id == user.id)
        ).all()
    ]
    return {
        "id": str(user.id),
        "email": user.email,
        "fullName": user.full_name,
        "role": user.role.value,
        "isActive": user.is_active,
        "batchIds": batch_ids,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }


def _validate_assignment(role: UserRole, batch_ids: list[uuid.UUID]) -> None:
    if role == UserRole.STUDENT and len(batch_ids) != 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A student must be assigned exactly one batch")


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate, db: DBSession = Depends(get_db), _: User = Depends(require_admin)
) -> dict:
    if db.scalar(select(User).where(User.email == body.email.lower())) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    _validate_assignment(body.role, body.batch_ids)
    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
    )
    db.add(user)
    db.flush()
    if body.role != UserRole.ADMIN:
        _set_memberships(db, user, body.batch_ids)
    db.commit()
    db.refresh(user)
    return _user_dict(db, user)


@router.get("/users")
def list_users(db: DBSession = Depends(get_db), _: User = Depends(require_admin)) -> list[dict]:
    users = list(db.scalars(select(User).order_by(User.role, User.created_at.desc())).all())
    return [_user_dict(db, u) for u in users]


@router.patch("/users/{user_id}")
def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    fields = body.model_dump(exclude_unset=True)
    # last-active-admin guard: block demote / deactivate of the final admin
    demoting = "role" in fields and body.role != UserRole.ADMIN
    deactivating = fields.get("is_active") is False
    if user.role == UserRole.ADMIN and (demoting or deactivating) and _active_admin_count(db) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot remove the last active admin")

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        user.role = body.role
    if body.batch_ids is not None:
        role = body.role or user.role
        _validate_assignment(role, body.batch_ids)
        if role == UserRole.ADMIN:
            db.query(BatchMember).filter(BatchMember.user_id == user.id).delete()
        else:
            _set_memberships(db, user, body.batch_ids)
    db.commit()
    db.refresh(user)
    return _user_dict(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_user(
    user_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Response:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.role == UserRole.ADMIN and _active_admin_count(db) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete the last active admin")
    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/stats")
def admin_stats(db: DBSession = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    """Per-batch rows + totals across the whole school (sortable/filterable client-side)."""
    batches = list(db.scalars(select(Batch).order_by(Batch.year.desc(), Batch.program)).all())
    member_counts = dict(
        db.execute(select(BatchMember.batch_id, func.count()).group_by(BatchMember.batch_id)).all()
    )
    rows = []
    total_tokens = total_sessions = total_quizzes = 0
    for b in batches:
        sids = batch_session_ids(db, b.id)
        tokens = quizzes = 0
        if sids:
            tokens = db.scalar(
                select(func.coalesce(func.sum(Command.tokens_used), 0)).where(
                    Command.session_id.in_(sids)
                )
            ) or 0
            quizzes = db.scalar(
                select(func.count()).select_from(Quiz).where(Quiz.session_id.in_(sids))
            ) or 0
        total_tokens += int(tokens)
        total_sessions += len(sids)
        total_quizzes += int(quizzes)
        rows.append(
            {
                "id": str(b.id),
                "program": b.program,
                "semester": b.semester,
                "year": b.year,
                "section": b.section,
                "members": member_counts.get(b.id, 0),
                "sessions": len(sids),
                "quizzes": int(quizzes),
                "tokensUsed": int(tokens),
            }
        )
    courses = db.scalar(select(func.count()).select_from(Course)) or 0
    return {
        "batches": rows,
        "totals": {
            "batches": len(batches),
            "courses": int(courses),
            "sessions": total_sessions,
            "quizzes": total_quizzes,
            "tokensUsed": total_tokens,
        },
    }
