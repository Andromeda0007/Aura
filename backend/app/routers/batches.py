"""Batches (cohort/term) — top of the academic hierarchy, owned by a teacher."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.core.hierarchy import batch_session_ids
from app.models.batch import Batch
from app.models.command import Command
from app.models.course import Course
from app.models.user import User
from app.schemas.batch import BatchCreate, BatchOut, BatchUpdate
from app.routers.stats import aggregate_stats

router = APIRouter(prefix="/batches", tags=["batches"])


def _owned_batch(batch_id: uuid.UUID, db: DBSession, teacher: User) -> Batch:
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Batch not found")
    if batch.teacher_id != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your batch")
    return batch


@router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    body: BatchCreate, db: DBSession = Depends(get_db), teacher: User = Depends(get_current_teacher)
) -> BatchOut:
    batch = Batch(
        teacher_id=teacher.id,
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
    db: DBSession = Depends(get_db), teacher: User = Depends(get_current_teacher)
) -> list[dict]:
    batches = list(
        db.scalars(
            select(Batch).where(Batch.teacher_id == teacher.id).order_by(Batch.created_at.desc())
        ).all()
    )
    course_counts = dict(
        db.execute(
            select(Course.batch_id, func.count())
            .where(Course.teacher_id == teacher.id)
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
    teacher: User = Depends(get_current_teacher),
) -> BatchOut:
    return BatchOut.model_validate(_owned_batch(batch_id, db, teacher))


@router.patch("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id: uuid.UUID,
    body: BatchUpdate,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> BatchOut:
    batch = _owned_batch(batch_id, db, teacher)
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
    teacher: User = Depends(get_current_teacher),
) -> Response:
    batch = _owned_batch(batch_id, db, teacher)
    db.delete(batch)  # cascades to courses -> units -> sessions
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{batch_id}/stats")
def batch_stats(
    batch_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> dict:
    _owned_batch(batch_id, db, teacher)
    return aggregate_stats(db, batch_session_ids(db, batch_id))
