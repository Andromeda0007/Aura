"""Content Library — every generated piece of content across the teacher's sessions."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.core.access import accessible_session_ids
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.command import Command
from app.models.enums import CommandStatus
from app.models.session import Session
from app.models.user import User
from app.services.command_payload import response_type_for

router = APIRouter(prefix="/library", tags=["library"])


@router.get("")
def library(
    db: DBSession = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    ids = accessible_session_ids(db, user)
    rows = db.execute(
        select(Command, Session.subject)
        .join(Session, Command.session_id == Session.id)
        .where(Command.session_id.in_(ids), Command.status == CommandStatus.COMPLETED)
        .order_by(Command.timestamp.desc())
        .limit(300)
    ).all()
    return [
        {
            "commandId": str(c.id),
            "type": response_type_for(c.intent.value),
            "command": c.raw_command,
            "data": c.llm_response,
            "sessionId": str(c.session_id),
            "subject": subject,
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
        }
        for c, subject in rows
    ]
