"""Session export — downloadable Markdown of transcript + AI outputs."""
from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.core.access import assert_batch_access, batch_of_session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.command import Command
from app.models.enums import CommandStatus
from app.models.session import Session
from app.models.transcript import Transcript
from app.models.user import User

router = APIRouter(prefix="/export", tags=["export"])


def _build_markdown(sess: Session, transcripts: list[Transcript], commands: list[Command]) -> str:
    lines = [f"# {sess.subject}", "", f"_Session {sess.id} — {sess.start_time:%Y-%m-%d %H:%M}_", ""]
    lines.append("## Transcript\n")
    if transcripts:
        for t in transcripts:
            lines.append(f"- {t.text}")
    else:
        lines.append("_No transcript captured._")
    lines.append("\n## AI Responses\n")
    if commands:
        for c in commands:
            lines.append(f"### {c.intent.value}  ·  _{c.raw_command}_")
            payload = c.llm_response or {}
            lines.append("```json")
            lines.append(json.dumps(payload, indent=2, ensure_ascii=False))
            lines.append("```\n")
    else:
        lines.append("_No AI responses generated._")
    return "\n".join(lines)


@router.get("/{session_id}")
def export_session(
    session_id: uuid.UUID,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    sess = db.get(Session, session_id)
    if sess is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    assert_batch_access(db, user, batch_of_session(db, session_id))

    transcripts = db.scalars(
        select(Transcript).where(Transcript.session_id == session_id).order_by(Transcript.timestamp)
    ).all()
    commands = db.scalars(
        select(Command)
        .where(Command.session_id == session_id, Command.status == CommandStatus.COMPLETED)
        .order_by(Command.timestamp)
    ).all()

    md = _build_markdown(sess, list(transcripts), list(commands))
    safe = "".join(ch if ch.isalnum() else "_" for ch in sess.subject)[:40] or "session"
    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{safe}.md"'},
    )
