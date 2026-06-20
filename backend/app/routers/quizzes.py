"""Quizzes: public access + submission, and teacher-side results/analytics."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.models.quiz import Quiz
from app.models.quiz_attempt import QuizAttempt
from app.models.session import Session
from app.models.user import User

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


class AttemptIn(BaseModel):
    student_name: str | None = Field(default=None, max_length=160)
    answers: list[int]


@router.get("")
def list_quizzes(
    db: DBSession = Depends(get_db), teacher: User = Depends(get_current_teacher)
) -> list[dict]:
    """Teacher's quizzes with attempt counts."""
    rows = db.execute(
        select(Quiz, Session.subject, func.count(QuizAttempt.id))
        .join(Session, Quiz.session_id == Session.id)
        .outerjoin(QuizAttempt, QuizAttempt.quiz_id == Quiz.id)
        .where(Session.teacher_id == teacher.id)
        .group_by(Quiz.id, Session.subject)
        .order_by(Quiz.created_at.desc())
    ).all()
    return [
        {
            "id": str(q.id),
            "shareCode": q.share_code,
            "subject": subject,
            "questionCount": len((q.quiz_data or {}).get("questions", [])),
            "attempts": attempts,
            "createdAt": q.created_at.isoformat() if q.created_at else None,
        }
        for q, subject, attempts in rows
    ]


@router.get("/{share_code}")
def get_quiz(share_code: str, db: DBSession = Depends(get_db)) -> dict:
    """PUBLIC — fetch a quiz by share code (no auth)."""
    quiz = db.scalar(select(Quiz).where(Quiz.share_code == share_code))
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    return {"share_code": quiz.share_code, "quiz_data": quiz.quiz_data}


@router.post("/{share_code}/submit")
def submit_attempt(share_code: str, body: AttemptIn, db: DBSession = Depends(get_db)) -> dict:
    """PUBLIC — a student submits answers; grade + record + return the result."""
    quiz = db.scalar(select(Quiz).where(Quiz.share_code == share_code))
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    questions = (quiz.quiz_data or {}).get("questions", [])
    total = len(questions)
    correct = []
    for i, qn in enumerate(questions):
        chosen = body.answers[i] if i < len(body.answers) else -1
        correct.append(chosen == qn.get("answer_index"))
    score = sum(correct)
    db.add(
        QuizAttempt(
            quiz_id=quiz.id,
            student_name=(body.student_name or None),
            answers=body.answers,
            score=score,
            total=total,
        )
    )
    db.commit()
    return {"score": score, "total": total, "correct": correct}


@router.get("/{quiz_id}/results")
def quiz_results(
    quiz_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    teacher: User = Depends(get_current_teacher),
) -> dict:
    """Teacher analytics for one quiz (must own it)."""
    row = db.execute(
        select(Quiz, Session).join(Session, Quiz.session_id == Session.id).where(Quiz.id == quiz_id)
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    quiz, sess = row
    if sess.teacher_id != teacher.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your quiz")

    attempts = list(
        db.scalars(
            select(QuizAttempt)
            .where(QuizAttempt.quiz_id == quiz_id)
            .order_by(QuizAttempt.created_at.desc())
        ).all()
    )
    questions = (quiz.quiz_data or {}).get("questions", [])
    total = len(questions)
    n = len(attempts)
    avg = round(sum(a.score for a in attempts) / n, 2) if n else 0.0

    miss = [0] * total
    for a in attempts:
        for i, qn in enumerate(questions):
            chosen = a.answers[i] if i < len(a.answers) else -1
            if chosen != qn.get("answer_index"):
                miss[i] += 1
    most_missed = sorted(
        (
            {"question": questions[i].get("question", ""), "missRate": round(miss[i] / n, 2) if n else 0.0}
            for i in range(total)
        ),
        key=lambda x: -x["missRate"],
    )[:3]

    return {
        "shareCode": quiz.share_code,
        "subject": sess.subject,
        "total": total,
        "attempts": n,
        "avgScore": avg,
        "mostMissed": most_missed,
        "recent": [
            {
                "name": a.student_name or "Anonymous",
                "score": a.score,
                "total": a.total,
                "at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in attempts[:20]
        ],
    }
