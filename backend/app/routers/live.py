"""Public live-session access: students resolve a join code to a session they
can watch read-only (board mirror + transcript) over Socket.IO."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.session import Session

router = APIRouter(prefix="/live", tags=["live"])


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
