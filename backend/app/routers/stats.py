"""Read-only analytics aggregations for the teacher's own data."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.models.command import Command
from app.models.quiz import Quiz
from app.models.session import Session
from app.models.transcript import Transcript
from app.models.user import User

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview")
def overview(db: DBSession = Depends(get_db), teacher: User = Depends(get_current_teacher)) -> dict:
    sub = select(Session.id).where(Session.teacher_id == teacher.id).scalar_subquery()

    total_sessions = db.scalar(
        select(func.count()).select_from(Session).where(Session.teacher_id == teacher.id)
    )
    total_commands = db.scalar(select(func.count()).select_from(Command).where(Command.session_id.in_(sub)))
    total_quizzes = db.scalar(select(func.count()).select_from(Quiz).where(Quiz.session_id.in_(sub)))
    total_transcripts = db.scalar(
        select(func.count()).select_from(Transcript).where(Transcript.session_id.in_(sub))
    )

    latencies = list(
        db.scalars(
            select(Command.processing_time_ms).where(
                Command.session_id.in_(sub), Command.processing_time_ms.isnot(None)
            )
        ).all()
    )
    avg_latency = round(sum(latencies) / len(latencies)) if latencies else 0
    p95_latency = 0
    if latencies:
        ordered = sorted(latencies)
        p95_latency = ordered[min(len(ordered) - 1, int(0.95 * len(ordered)))]

    intent_rows = db.execute(
        select(Command.intent, func.count()).where(Command.session_id.in_(sub)).group_by(Command.intent)
    ).all()
    intent_mix = {row[0].value: row[1] for row in intent_rows}

    return {
        "totalSessions": total_sessions or 0,
        "totalCommands": total_commands or 0,
        "totalQuizzes": total_quizzes or 0,
        "totalTranscripts": total_transcripts or 0,
        "avgLatencyMs": avg_latency,
        "p95LatencyMs": p95_latency,
        "intentMix": intent_mix,
    }


@router.get("/activity")
def activity(db: DBSession = Depends(get_db), teacher: User = Depends(get_current_teacher)) -> dict:
    sub = select(Session.id).where(Session.teacher_id == teacher.id).scalar_subquery()
    sess_rows = db.execute(
        select(func.date(Session.created_at), func.count())
        .where(Session.teacher_id == teacher.id)
        .group_by(func.date(Session.created_at))
    ).all()
    cmd_rows = db.execute(
        select(func.date(Command.timestamp), func.count())
        .where(Command.session_id.in_(sub))
        .group_by(func.date(Command.timestamp))
    ).all()

    def fmt(rows: list) -> dict[str, int]:
        return {str(r[0]): r[1] for r in rows}

    return {"sessionsByDay": fmt(sess_rows), "commandsByDay": fmt(cmd_rows)}
