"""Public live-session access: students resolve a join code to a session they
can watch read-only (board mirror + transcript) over Socket.IO."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.session import Session
from app.models.transcript import Transcript
from app.services.ai_service import ai_service

router = APIRouter(prefix="/live", tags=["live"])


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=600)


@router.get("/{join_code}")
def resolve_live(join_code: str, db: DBSession = Depends(get_db)) -> dict:
    """PUBLIC — resolve a join code to a session for a student viewer."""
    sess = db.scalar(select(Session).where(Session.join_code == join_code.upper()))
    if sess is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return {
        "sessionId": str(sess.id),
        "subject": sess.subject,
        "status": sess.status.value,
        "joinCode": sess.join_code,
    }


@router.post("/{join_code}/ask")
async def ask_tutor(join_code: str, body: AskIn, db: DBSession = Depends(get_db)) -> dict:
    """PUBLIC — a student asks Aura a follow-up grounded in this class's transcript."""
    sess = db.scalar(select(Session).where(Session.join_code == join_code.upper()))
    if sess is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    rows = db.scalars(
        select(Transcript.text)
        .where(Transcript.session_id == sess.id)
        .order_by(Transcript.timestamp.desc())
        .limit(40)
    ).all()
    context = "\n".join(reversed(list(rows))) or f"This is a class about {sess.subject}."
    result = await ai_service.answer_question(context, body.question)
    return {"answer": result.get("answer") or result.get("error") or "I'm not sure yet."}
