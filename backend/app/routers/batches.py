"""Batches (cohort/term) — admin creates/manages; teachers/students access by membership."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.access import accessible_batch_ids, assert_batch_access
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.hierarchy import batch_session_ids
from app.models.batch import Batch
from app.models.command import Command
from app.models.course import Course
from app.models.user import User
from app.schemas.batch import BatchCreate, BatchOut, BatchUpdate
from app.routers.stats import aggregate_stats

router = APIRouter(prefix="/batches", tags=["batches"])


@router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    body: BatchCreate, db: DBSession = Depends(get_db), admin: User = Depends(require_admin)
) -> BatchOut:
    batch = Batch(
        created_by=admin.id,
        program=body.program,
        semester=body.semester,
        year=body.year,
        section=body.section,
        roster=[],
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return BatchOut.model_validate(batch)


@router.get("")
def list_batches(
    db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    allowed = accessible_batch_ids(db, user)  # None = admin (all)
    q = select(Batch).order_by(Batch.year.desc(), Batch.created_at.desc())
    if allowed is not None:
        if not allowed:
            return []
        q = q.where(Batch.id.in_(allowed))
    batches = list(db.scalars(q).all())

    course_counts = dict(
        db.execute(
            select(Course.batch_id, func.count())
            .where(Course.batch_id.in_([b.id for b in batches] or [uuid.uuid4()]))
            .group_by(Course.batch_id)
        ).all()
    )
    out = []
    for b in batches:
        sids = batch_session_ids(db, b.id)
        tokens = 0
        if sids:
            tokens = db.scalar(
                select(func.coalesce(func.sum(Command.tokens_used), 0)).where(
                    Command.session_id.in_(sids)
                )
            ) or 0
        out.append(
            {
                "id": str(b.id),
                "program": b.program,
                "semester": b.semester,
                "year": b.year,
                "section": b.section,
                "archived": b.archived,
                "courses": course_counts.get(b.id, 0),
                "sessions": len(sids),
                "tokensUsed": int(tokens),
                "createdAt": b.created_at.isoformat() if b.created_at else None,
            }
        )
    return out


@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(
    batch_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BatchOut:
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Batch not found")
    assert_batch_access(db, user, batch_id)
    return BatchOut.model_validate(batch)


@router.patch("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id: uuid.UUID,
    body: BatchUpdate,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> BatchOut:
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Batch not found")
    fields = body.model_dump(exclude_unset=True)
    if "roster" in fields and body.roster is not None:
        batch.roster = [r.model_dump() for r in body.roster]
        fields.pop("roster")
    for key, value in fields.items():
        setattr(batch, key, value)
    db.commit()
    db.refresh(batch)
    return BatchOut.model_validate(batch)


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_batch(
    batch_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Batch not found")
    db.delete(batch)  # cascades to courses -> units -> sessions, and batch_members
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{batch_id}/stats")
def batch_stats(
    batch_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    assert_batch_access(db, user, batch_id)
    return aggregate_stats(db, batch_session_ids(db, batch_id))
