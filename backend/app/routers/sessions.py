"""Session lifecycle routes — access gated by batch membership (via the unit)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.access import accessible_session_ids, assert_batch_access, batch_of_session, batch_of_unit
from app.core.database import get_db
from app.core.deps import get_current_user, require_staff
from app.core.logging import get_logger
from app.models.command import Command
from app.models.enums import CommandIntent, CommandStatus, SessionStatus
from app.models.quiz import Quiz
from app.models.quiz_attempt import QuizAttempt
from app.models.session import Session
from app.models.transcript import Transcript
from app.models.unit import Unit
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


def _session_or_404(session_id: uuid.UUID, db: DBSession) -> Session:
    sess = db.get(Session, session_id)
    if sess is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return sess


def _read(session_id: uuid.UUID, db: DBSession, user: User) -> Session:
    sess = _session_or_404(session_id, db)
    assert_batch_access(db, user, batch_of_session(db, session_id))
    return sess


def _write(session_id: uuid.UUID, db: DBSession, user: User) -> Session:
    sess = _session_or_404(session_id, db)
    assert_batch_access(db, user, batch_of_session(db, session_id), write=True)
    return sess


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    db: DBSession = Depends(get_db),
    user: User = Depends(require_staff),
) -> SessionOut:
    if body.unit_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unit_id is required")
    if db.get(Unit, body.unit_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unit not found")
    assert_batch_access(db, user, batch_of_unit(db, body.unit_id), write=True)
    sess = Session(
        teacher_id=user.id,
        unit_id=body.unit_id,
        subject=body.subject,
        language=body.language or "English",
        status=SessionStatus.ACTIVE,
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    logger.info("session.create", session_id=str(sess.id), teacher_id=str(user.id))
    return SessionOut.model_validate(sess)


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: uuid.UUID,
    body: SessionUpdate,
    db: DBSession = Depends(get_db),
    user: User = Depends(require_staff),
) -> SessionOut:
    """(Re)assign the session's unit and/or language (only fields the client sends)."""
    sess = _write(session_id, db, user)
    fields = body.model_fields_set
    if "unit_id" in fields and body.unit_id is not None:
        if db.get(Unit, body.unit_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Unit not found")
        assert_batch_access(db, user, batch_of_unit(db, body.unit_id), write=True)
        sess.unit_id = body.unit_id
    if "language" in fields and body.language:
        sess.language = body.language
    db.commit()
    db.refresh(sess)
    return SessionOut.model_validate(sess)


@router.get("", response_model=list[SessionOut])
def list_sessions(
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SessionOut]:
    ids = accessible_session_ids(db, user)
    if not ids:
        return []
    rows = db.scalars(
        select(Session).where(Session.id.in_(ids)).order_by(Session.created_at.desc())
    ).all()
    return [SessionOut.model_validate(s) for s in rows]


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionOut:
    return SessionOut.model_validate(_read(session_id, db, user))


@router.get("/{session_id}/history")
def session_history(
    session_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Transcripts + completed AI responses (restore an open session / view history)."""
    sess = _read(session_id, db, user)
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
            {
                "id": str(t.id),
                "text": t.text,
                "starred": t.starred,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            }
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


class StarUpdate(BaseModel):
    starred: bool


@router.patch("/{session_id}/transcripts/{transcript_id}/star")
def star_transcript(
    session_id: uuid.UUID,
    transcript_id: uuid.UUID,
    body: StarUpdate,
    db: DBSession = Depends(get_db),
    user: User = Depends(require_staff),
) -> dict:
    """Star/unstar a transcript line ('star this moment')."""
    _write(session_id, db, user)
    t = db.get(Transcript, transcript_id)
    if t is None or t.session_id != session_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transcript not found")
    t.starred = body.starred
    db.commit()
    return {"id": str(t.id), "starred": t.starred}


@router.post("/{session_id}/end", response_model=SessionOut)
def end_session(
    session_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(require_staff),
) -> SessionOut:
    sess = _write(session_id, db, user)
    if sess.status != SessionStatus.COMPLETED:
        sess.status = SessionStatus.COMPLETED
        sess.end_time = datetime.now(timezone.utc)
        db.commit()
        db.refresh(sess)
    logger.info("session.end", session_id=str(sess.id))
    return SessionOut.model_validate(sess)


@router.get("/{session_id}/report")
def session_report(
    session_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Auto end-of-class recap: summary + key concepts + quizzes + stats."""
    sess = _read(session_id, db, user)

    summary_cmd = db.scalar(
        select(Command)
        .where(
            Command.session_id == sess.id,
            Command.intent == CommandIntent.SUMMARIZE,
            Command.status == CommandStatus.COMPLETED,
        )
        .order_by(Command.timestamp.desc())
    )
    summary_data = (summary_cmd.llm_response or {}) if summary_cmd else {}

    key_concepts: list[str] = []
    for seg in sess.compressed_history or []:
        if isinstance(seg, dict):
            key_concepts.extend((seg.get("keyConcepts") or {}).keys())
    key_concepts = list(dict.fromkeys(key_concepts))[:12]

    quiz_rows = db.execute(
        select(
            Quiz.share_code,
            Quiz.quiz_data,
            func.count(QuizAttempt.id),
            func.avg(QuizAttempt.score * 1.0 / func.nullif(QuizAttempt.total, 0)),
        )
        .outerjoin(QuizAttempt, QuizAttempt.quiz_id == Quiz.id)
        .where(Quiz.session_id == sess.id)
        .group_by(Quiz.id)
    ).all()
    quizzes = [
        {
            "shareCode": code,
            "questionCount": len((data or {}).get("questions", [])),
            "attempts": n,
            "avgPct": round((avg or 0) * 100),
        }
        for code, data, n, avg in quiz_rows
    ]

    highlights = list(
        db.scalars(
            select(Transcript.text)
            .where(Transcript.session_id == sess.id, Transcript.starred.is_(True))
            .order_by(Transcript.timestamp)
        ).all()
    )

    commands = db.scalar(
        select(func.count()).select_from(Command).where(Command.session_id == sess.id)
    )
    transcripts = db.scalar(
        select(func.count()).select_from(Transcript).where(Transcript.session_id == sess.id)
    )
    duration_min = None
    if sess.end_time and sess.start_time:
        duration_min = round((sess.end_time - sess.start_time).total_seconds() / 60)

    return {
        "subject": sess.subject,
        "status": sess.status.value,
        "date": sess.created_at.isoformat() if sess.created_at else None,
        "durationMin": duration_min,
        "summary": summary_data.get("summary", ""),
        "keyPoints": summary_data.get("keyPoints", []),
        "keyConcepts": key_concepts,
        "highlights": highlights,
        "quizzes": quizzes,
        "stats": {"commands": commands or 0, "transcripts": transcripts or 0},
    }
