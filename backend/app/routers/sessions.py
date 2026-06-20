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
from app.models.command import Command
from app.models.enums import CommandStatus, SessionStatus
from app.models.session import Session
from app.models.transcript import Transcript
from app.models.course import Course
from app.models.user import User
from app.schemas.session import SessionCreate, SessionOut, SessionUpdate

_INTENT_RESPONSE_TYPE = {
    "generate_quiz": "quiz",
    "summarize": "summary",
    "explain": "explanation",
    "generate_example": "example",
    "generate_diagram": "diagram",
    "answer_question": "answer",
    "format_board": "format_board",
    "other": "answer",
}

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
    course_id = None
    if body.course_id is not None:
        course = db.get(Course, body.course_id)
        if course is None or course.teacher_id != teacher.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
        course_id = course.id
    sess = Session(
        teacher_id=teacher.id,
        course_id=course_id,
        subject=body.subject,
        status=SessionStatus.ACTIVE,
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    logger.info("session.create", session_id=str(sess.id), teacher_id=str(teacher.id))
    return SessionOut.model_validate(sess)


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: uuid.UUID,
    body: SessionUpdate,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> SessionOut:
    """Currently only (re)assigns the session to one of the teacher's courses."""
    sess = _owned_session(session_id, db, teacher)
    if body.course_id is not None:
        course = db.get(Course, body.course_id)
        if course is None or course.teacher_id != teacher.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
        sess.course_id = course.id
    else:
        sess.course_id = None
    db.commit()
    db.refresh(sess)
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


@router.get("/{session_id}/history")
def session_history(
    session_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> dict:
    """Transcripts + completed AI responses, for restoring an open session."""
    sess = _owned_session(session_id, db, teacher)
    transcripts = db.scalars(
        select(Transcript).where(Transcript.session_id == sess.id).order_by(Transcript.timestamp)
    ).all()
    commands = db.scalars(
        select(Command)
        .where(Command.session_id == sess.id, Command.status == CommandStatus.COMPLETED)
        .order_by(Command.timestamp)
    ).all()
    return {
        "transcripts": [
            {"id": str(t.id), "text": t.text, "timestamp": t.timestamp.isoformat() if t.timestamp else None}
            for t in transcripts
        ],
        "commands": [
            {
                "commandId": str(c.id),
                "type": _INTENT_RESPONSE_TYPE.get(c.intent.value, "answer"),
                "command": c.raw_command,
                "data": c.llm_response,
                "timestamp": c.timestamp.isoformat() if c.timestamp else None,
            }
            for c in commands
        ],
    }


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
