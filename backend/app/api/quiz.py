from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from ..core.database import get_db
from ..models import Quiz

router = APIRouter()


class QuizResponse(BaseModel):
    id: str
    share_code: str
    quiz_data: dict
    created_at: datetime
    expires_at: Optional[datetime]


@router.get("/{share_code}", response_model=QuizResponse)
async def get_quiz(share_code: str, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.share_code == share_code).first()

    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    if quiz.expires_at and quiz.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Quiz has expired")

    return QuizResponse(
        id=str(quiz.id),
        share_code=quiz.share_code,
        quiz_data=quiz.quiz_data,
        created_at=quiz.created_at,
        expires_at=quiz.expires_at,
    )
