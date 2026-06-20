"""Read-only analytics aggregations for the teacher's own data."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.access import accessible_session_ids
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.command import Command
from app.models.quiz import Quiz
from app.models.quiz_attempt import QuizAttempt
from app.models.session import Session
from app.models.transcript import Transcript
from app.models.user import User

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview")
def overview(db: DBSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    sub = accessible_session_ids(db, user)

    total_sessions = len(sub)
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
def activity(db: DBSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    sub = accessible_session_ids(db, user)
    sess_rows = db.execute(
        select(func.date(Session.created_at), func.count())
        .where(Session.id.in_(sub))
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


@router.get("/deep")
def deep(db: DBSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """Per-subject activity, per-quiz performance, and hardest concepts."""
    sub = accessible_session_ids(db, user)
    mine = Session.id.in_(sub)

    # --- per subject ---
    sess_by_subj = dict(
        db.execute(
            select(Session.subject, func.count()).where(mine).group_by(Session.subject)
        ).all()
    )
    cmd_by_subj = dict(
        db.execute(
            select(Session.subject, func.count())
            .join(Command, Command.session_id == Session.id)
            .where(mine)
            .group_by(Session.subject)
        ).all()
    )
    pct = QuizAttempt.score * 1.0 / func.nullif(QuizAttempt.total, 0)
    attempt_by_subj = db.execute(
        select(Session.subject, func.count(QuizAttempt.id), func.avg(pct))
        .join(Quiz, Quiz.session_id == Session.id)
        .join(QuizAttempt, QuizAttempt.quiz_id == Quiz.id)
        .where(mine)
        .group_by(Session.subject)
    ).all()
    attempts_map = {r[0]: (r[1], r[2]) for r in attempt_by_subj}

    by_subject = sorted(
        (
            {
                "subject": subj,
                "sessions": cnt,
                "commands": cmd_by_subj.get(subj, 0),
                "attempts": attempts_map.get(subj, (0, None))[0],
                "avgPct": round((attempts_map.get(subj, (0, 0))[1] or 0) * 100),
            }
            for subj, cnt in sess_by_subj.items()
        ),
        key=lambda x: -x["sessions"],
    )

    # --- per quiz performance ---
    quiz_rows = db.execute(
        select(Quiz.id, Session.subject, func.count(QuizAttempt.id), func.avg(pct))
        .join(Session, Quiz.session_id == Session.id)
        .join(QuizAttempt, QuizAttempt.quiz_id == Quiz.id)
        .where(mine)
        .group_by(Quiz.id, Session.subject)
    ).all()
    quiz_performance = sorted(
        (
            {
                "quizId": str(qid),
                "subject": subj,
                "attempts": n,
                "avgPct": round((avg or 0) * 100),
            }
            for qid, subj, n, avg in quiz_rows
        ),
        key=lambda x: x["avgPct"],  # hardest first
    )[:8]

    # --- hardest concepts (aggregate miss rate across attempts) ---
    quizzes = db.execute(
        select(Quiz.id, Session.subject, Quiz.quiz_data)
        .join(Session, Quiz.session_id == Session.id)
        .where(mine)
    ).all()
    hardest: list[dict] = []
    for qid, subj, quiz_data in quizzes:
        questions = (quiz_data or {}).get("questions", [])
        if not questions:
            continue
        attempts = list(
            db.scalars(select(QuizAttempt).where(QuizAttempt.quiz_id == qid)).all()
        )
        if not attempts:
            continue
        for i, qn in enumerate(questions):
            miss = sum(
                1
                for a in attempts
                if (a.answers[i] if i < len(a.answers) else -1) != qn.get("answer_index")
            )
            hardest.append(
                {
                    "subject": subj,
                    "question": qn.get("question", ""),
                    "missRate": round(miss / len(attempts), 2),
                    "attempts": len(attempts),
                }
            )
    hardest = sorted((h for h in hardest if h["missRate"] > 0), key=lambda x: -x["missRate"])[:6]

    return {
        "bySubject": by_subject,
        "quizPerformance": quiz_performance,
        "hardestConcepts": hardest,
    }


# ---- reusable scoped aggregator (unit / course / batch stats) ----
def aggregate_stats(db: DBSession, session_ids: list) -> dict:
    """Compute a stats payload for an arbitrary set of session ids (any hierarchy
    level resolves to its leaf sessions, then calls this)."""
    if not session_ids:
        return {
            "totalSessions": 0,
            "totalCommands": 0,
            "totalQuizzes": 0,
            "totalTranscripts": 0,
            "avgLatencyMs": 0,
            "tokensUsed": 0,
            "intentMix": {},
            "hardestConcepts": [],
        }

    in_sessions = Command.session_id.in_(session_ids)
    total_commands = db.scalar(select(func.count()).select_from(Command).where(in_sessions)) or 0
    total_quizzes = db.scalar(
        select(func.count()).select_from(Quiz).where(Quiz.session_id.in_(session_ids))
    ) or 0
    total_transcripts = db.scalar(
        select(func.count()).select_from(Transcript).where(Transcript.session_id.in_(session_ids))
    ) or 0
    tokens_used = db.scalar(
        select(func.coalesce(func.sum(Command.tokens_used), 0)).where(in_sessions)
    ) or 0

    latencies = list(
        db.scalars(
            select(Command.processing_time_ms).where(
                in_sessions, Command.processing_time_ms.isnot(None)
            )
        ).all()
    )
    avg_latency = round(sum(latencies) / len(latencies)) if latencies else 0

    intent_rows = db.execute(
        select(Command.intent, func.count()).where(in_sessions).group_by(Command.intent)
    ).all()
    intent_mix = {row[0].value: row[1] for row in intent_rows}

    # hardest concepts across these sessions' quizzes
    quizzes = list(
        db.scalars(select(Quiz).where(Quiz.session_id.in_(session_ids))).all()
    )
    hardest: list[dict] = []
    for quiz in quizzes:
        questions = (quiz.quiz_data or {}).get("questions", [])
        if not questions:
            continue
        attempts = list(
            db.scalars(select(QuizAttempt).where(QuizAttempt.quiz_id == quiz.id)).all()
        )
        if not attempts:
            continue
        for i, qn in enumerate(questions):
            miss = sum(
                1
                for a in attempts
                if (a.answers[i] if i < len(a.answers) else -1) != qn.get("answer_index")
            )
            hardest.append(
                {"question": qn.get("question", ""), "missRate": round(miss / len(attempts), 2)}
            )
    hardest = sorted((h for h in hardest if h["missRate"] > 0), key=lambda x: -x["missRate"])[:6]

    return {
        "totalSessions": len(session_ids),
        "totalCommands": total_commands,
        "totalQuizzes": total_quizzes,
        "totalTranscripts": total_transcripts,
        "avgLatencyMs": avg_latency,
        "tokensUsed": int(tokens_used),
        "intentMix": intent_mix,
        "hardestConcepts": hardest,
    }
