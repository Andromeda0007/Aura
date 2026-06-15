"""Public quiz access by share code (no auth — students take quizzes)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.quiz import Quiz

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.get("/{share_code}")
def get_quiz(share_code: str, db: DBSession = Depends(get_db)) -> dict:
    quiz = db.scalar(select(Quiz).where(Quiz.share_code == share_code))
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    # Public payload — only the quiz content + code, nothing about the teacher/session.
    return {"share_code": quiz.share_code, "quiz_data": quiz.quiz_data}
