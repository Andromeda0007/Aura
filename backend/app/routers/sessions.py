"""Session lifecycle routes (teacher-owned)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.core.logging import get_logger
from app.models.command import Command
from app.models.enums import CommandStatus, SessionStatus
from app.models.quiz import Quiz
from app.models.quiz_attempt import QuizAttempt
from app.models.course import Course
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
    def _owned_unit(unit_id: uuid.UUID) -> Unit:
        unit = db.get(Unit, unit_id)
        if unit is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Unit not found")
        course = db.get(Course, unit.course_id)
        if course is None or course.teacher_id != teacher.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your unit")
        return unit

    unit_id = None
    if body.unit_id is not None:
        unit_id = _owned_unit(body.unit_id).id
    sess = Session(
        teacher_id=teacher.id,
        unit_id=unit_id,
        subject=body.subject,
        language=body.language or "English",
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
    """(Re)assign the session's unit and/or language. Only fields the client
    actually sends are changed (so a language-only update keeps the unit)."""
    sess = _owned_session(session_id, db, teacher)
    fields = body.model_fields_set
    if "unit_id" in fields:
        if body.unit_id is not None:
            unit = db.get(Unit, body.unit_id)
            course = db.get(Course, unit.course_id) if unit else None
            if unit is None or course is None or course.teacher_id != teacher.id:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Unit not found")
            sess.unit_id = unit.id
        else:
            sess.unit_id = None
    if "language" in fields and body.language:
        sess.language = body.language
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
    teacher: User = Depends(get_current_teacher),
) -> dict:
    """Star/unstar a transcript line ('star this moment')."""
    _owned_session(session_id, db, teacher)
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


@router.get("/{session_id}/report")
def session_report(
    session_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> dict:
    """Auto end-of-class recap: summary + key concepts + quizzes + stats."""
    sess = _owned_session(session_id, db, teacher)

    # latest generated summary (if any) for the recap text
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

    # key concepts: from compressed history if present
    key_concepts: list[str] = []
    for seg in sess.compressed_history or []:
        if isinstance(seg, dict):
            key_concepts.extend((seg.get("keyConcepts") or {}).keys())
    key_concepts = list(dict.fromkeys(key_concepts))[:12]

    # quizzes with attempt stats
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
