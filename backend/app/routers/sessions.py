"""Session lifecycle routes (teacher-owned)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.core.logging import get_logger
from app.models.enums import SessionStatus
from app.models.session import Session
from app.models.user import User
from app.schemas.session import SessionCreate, SessionOut

router = APIRouter(prefix="/sessions", tags=["sessions"])
logger = get_logger("aura.sessions")


def _owned_session(session_id: uuid.UUID, db: DBSession, teacher: User) -> Session:
    sess = db.get(Session, session_id)
    if sess is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if sess.teacher_id != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your session")
    return sess


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> SessionOut:
    sess = Session(teacher_id=teacher.id, subject=body.subject, status=SessionStatus.ACTIVE)
    db.add(sess)
    db.commit()
    db.refresh(sess)
    logger.info("session.create", session_id=str(sess.id), teacher_id=str(teacher.id))
    return SessionOut.model_validate(sess)


@router.get("", response_model=list[SessionOut])
def list_sessions(
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> list[SessionOut]:
    rows = db.scalars(
        select(Session).where(Session.teacher_id == teacher.id).order_by(Session.created_at.desc())
    ).all()
    return [SessionOut.model_validate(s) for s in rows]


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> SessionOut:
    return SessionOut.model_validate(_owned_session(session_id, db, teacher))


@router.post("/{session_id}/end", response_model=SessionOut)
def end_session(
    session_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> SessionOut:
    sess = _owned_session(session_id, db, teacher)
    if sess.status != SessionStatus.COMPLETED:
        sess.status = SessionStatus.COMPLETED
        sess.end_time = datetime.now(timezone.utc)
        db.commit()
        db.refresh(sess)
    logger.info("session.end", session_id=str(sess.id))
    return SessionOut.model_validate(sess)
