from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..core.database import get_db
from ..models import Quiz, QuizAttempt

router = APIRouter()


class QuizQuestionResponse(BaseModel):
    question: str
    options: List[str]


class QuizResponse(BaseModel):
    id: str
    share_code: str
    quiz_data: dict
    created_at: datetime
    expires_at: Optional[datetime]


class SubmitQuizRequest(BaseModel):
    answers: List[int]
    student_name: Optional[str] = None


class QuizAttemptResponse(BaseModel):
    id: str
    score: int
    total_questions: int
    percentage: float
    submitted_at: datetime


@router.get("/{share_code}", response_model=QuizResponse)
async def get_quiz(share_code: str, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.share_code == share_code).first()
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )
    
    if quiz.expires_at and quiz.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Quiz has expired",
        )
    
    return QuizResponse(
        id=str(quiz.id),
        share_code=quiz.share_code,
        quiz_data=quiz.quiz_data,
        created_at=quiz.created_at,
        expires_at=quiz.expires_at,
    )


@router.post("/{share_code}/submit", response_model=QuizAttemptResponse)
async def submit_quiz(
    share_code: str,
    request: SubmitQuizRequest,
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(Quiz.share_code == share_code).first()
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )
    
    if quiz.expires_at and quiz.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Quiz has expired",
        )
    
    questions = quiz.quiz_data.get("questions", [])
    total_questions = len(questions)
    
    if len(request.answers) != total_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expected {total_questions} answers, got {len(request.answers)}",
        )
    
    score = sum(
        1 for i, answer in enumerate(request.answers)
        if answer == questions[i].get("correctAnswer", -1)
    )
    
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        student_name=request.student_name,
        answers=request.answers,
        score=score,
    )
    
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    
    percentage = (score / total_questions * 100) if total_questions > 0 else 0
    
    return QuizAttemptResponse(
        id=str(attempt.id),
        score=score,
        total_questions=total_questions,
        percentage=round(percentage, 2),
        submitted_at=attempt.submitted_at,
    )


@router.get("/{share_code}/results")
async def get_quiz_results(share_code: str, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.share_code == share_code).first()
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )
    
    attempts = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz.id).all()
    
    total_questions = len(quiz.quiz_data.get("questions", []))
    
    return {
        "quiz_id": str(quiz.id),
        "share_code": quiz.share_code,
        "total_attempts": len(attempts),
        "average_score": sum(a.score for a in attempts) / len(attempts) if attempts else 0,
        "attempts": [
            {
                "id": str(a.id),
                "student_name": a.student_name,
                "score": a.score,
                "percentage": round((a.score / total_questions * 100) if total_questions > 0 else 0, 2),
                "submitted_at": a.submitted_at,
            }
            for a in attempts
        ],
    }
