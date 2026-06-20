"""Teacher superpowers — on-demand AI generation tools (teacher-auth only)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import require_staff
from app.models.user import User
from app.services.ai_service import ai_service

router = APIRouter(prefix="/tools", tags=["tools"])

# Friendly reading-level labels -> prompt audience descriptions.
AUDIENCE = {
    "elementary": "an elementary-school reading level (grades 2-4), short simple sentences",
    "middle": "a middle-school reading level (grades 6-8)",
    "high": "a high-school reading level (grades 9-12)",
    "ell": "English-language learners: simpler vocabulary, define key terms, short sentences",
    "advanced": "an advanced/gifted level: richer vocabulary and deeper detail",
    "simplified": "a simplified, accessible version for students who need extra support (IEP-friendly): "
    "plain language, one idea per sentence, concrete examples",
}


class DifferentiateIn(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    level: str = "middle"


class LessonPlanIn(BaseModel):
    topic: str = Field(min_length=1, max_length=4000)
    grade: str = "middle school"
    minutes: int = Field(default=45, ge=5, le=240)


class WorksheetIn(BaseModel):
    topic: str = Field(min_length=1, max_length=4000)
    count: int = Field(default=8, ge=1, le=25)


class RubricIn(BaseModel):
    assignment: str = Field(min_length=1, max_length=4000)


class GradeIn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    guidance: str = Field(default="", max_length=4000)
    response: str = Field(min_length=1, max_length=8000)


class StandardsIn(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


@router.post("/differentiate")
async def differentiate(body: DifferentiateIn, _: User = Depends(require_staff)) -> dict:
    audience = AUDIENCE.get(body.level, AUDIENCE["middle"])
    return await ai_service.differentiate(body.content, audience)


@router.post("/lesson-plan")
async def lesson_plan(body: LessonPlanIn, _: User = Depends(require_staff)) -> dict:
    return await ai_service.lesson_plan(body.topic, body.grade, body.minutes)


@router.post("/worksheet")
async def worksheet(body: WorksheetIn, _: User = Depends(require_staff)) -> dict:
    return await ai_service.worksheet(body.topic, body.count)


@router.post("/rubric")
async def rubric(body: RubricIn, _: User = Depends(require_staff)) -> dict:
    return await ai_service.rubric(body.assignment)


@router.post("/grade")
async def grade(body: GradeIn, _: User = Depends(require_staff)) -> dict:
    return await ai_service.grade_open(body.question, body.guidance, body.response)


@router.post("/standards")
async def standards(body: StandardsIn, _: User = Depends(require_staff)) -> dict:
    return await ai_service.standards(body.content)
