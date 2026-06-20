"""Assignments (homework): teacher creates, students complete via share code."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.core.access import assert_semester_access, is_admin
from app.core.database import get_db
from app.core.deps import get_current_user, require_staff
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.course import Course
from app.models.quiz import Quiz
from app.models.user import User

router = APIRouter(prefix="/assignments", tags=["assignments"])


class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    instructions: str = Field(default="", max_length=8000)
    quiz_id: uuid.UUID | None = None
    course_id: uuid.UUID | None = None
    due_at: datetime | None = None


class SubmitIn(BaseModel):
    student_name: str | None = Field(default=None, max_length=160)
    answers: list[int] = Field(default_factory=list)


def _owned(assignment_id: uuid.UUID, db: DBSession, user: User) -> Assignment:
    a = db.get(Assignment, assignment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    if not is_admin(user) and a.teacher_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your assignment")
    return a


@router.post("", status_code=status.HTTP_201_CREATED)
def create_assignment(
    body: AssignmentCreate,
    db: DBSession = Depends(get_db),
    user: User = Depends(require_staff),
) -> dict:
    if body.quiz_id is not None:
        quiz = db.get(Quiz, body.quiz_id)
        if quiz is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    if body.course_id is not None:
        course = db.get(Course, body.course_id)
        if course is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
        assert_semester_access(db, user, course.semester_id, write=True)
    a = Assignment(
        teacher_id=user.id,
        course_id=body.course_id,
        quiz_id=body.quiz_id,
        title=body.title,
        instructions=body.instructions,
        due_at=body.due_at,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": str(a.id), "shareCode": a.share_code}


@router.get("")
def list_assignments(
    db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    q = (
        select(Assignment, func.count(AssignmentSubmission.id))
        .outerjoin(AssignmentSubmission, AssignmentSubmission.assignment_id == Assignment.id)
        .group_by(Assignment.id)
        .order_by(Assignment.created_at.desc())
    )
    if not is_admin(user):
        q = q.where(Assignment.teacher_id == user.id)
    rows = db.execute(q).all()
    return [
        {
            "id": str(a.id),
            "title": a.title,
            "shareCode": a.share_code,
            "hasQuiz": a.quiz_id is not None,
            "dueAt": a.due_at.isoformat() if a.due_at else None,
            "submissions": n,
            "createdAt": a.created_at.isoformat() if a.created_at else None,
        }
        for a, n in rows
    ]


@router.get("/{assignment_id}/submissions")
def submissions(
    assignment_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    a = _owned(assignment_id, db, user)
    subs = list(
        db.scalars(
            select(AssignmentSubmission)
            .where(AssignmentSubmission.assignment_id == a.id)
            .order_by(AssignmentSubmission.created_at.desc())
        ).all()
    )
    return {
        "title": a.title,
        "hasQuiz": a.quiz_id is not None,
        "submissions": [
            {
                "name": s.student_name or "Anonymous",
                "score": s.score,
                "total": s.total,
                "at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in subs
        ],
        "notSubmitted": [],
    }


@router.get("/code/{share_code}")
def public_assignment(share_code: str, db: DBSession = Depends(get_db)) -> dict:
    a = db.scalar(select(Assignment).where(Assignment.share_code == share_code))
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    quiz_data = None
    if a.quiz_id is not None:
        quiz = db.get(Quiz, a.quiz_id)
        quiz_data = quiz.quiz_data if quiz else None
    return {
        "title": a.title,
        "instructions": a.instructions,
        "dueAt": a.due_at.isoformat() if a.due_at else None,
        "quizData": quiz_data,
    }


@router.post("/code/{share_code}/submit")
def submit(share_code: str, body: SubmitIn, db: DBSession = Depends(get_db)) -> dict:
    a = db.scalar(select(Assignment).where(Assignment.share_code == share_code))
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    score, total = 0, 0
    if a.quiz_id is not None:
        quiz = db.get(Quiz, a.quiz_id)
        questions = (quiz.quiz_data or {}).get("questions", []) if quiz else []
        total = len(questions)
        for i, qn in enumerate(questions):
            chosen = body.answers[i] if i < len(body.answers) else -1
            if chosen == qn.get("answer_index"):
                score += 1
    db.add(
        AssignmentSubmission(
            assignment_id=a.id,
            student_name=(body.student_name or None),
            score=score,
            total=total,
        )
    )
    db.commit()
    return {"score": score, "total": total}
