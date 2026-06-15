"""Assemble fused lecture context (spoken + board + compressed history).

P5: built directly from the DB (recent transcripts + OCR + compressed_history).
P7 adds the live in-memory buffer + automatic compression.
"""
from __future__ import annotations

import json
import uuid

import sqlalchemy as sa

from app.core.config import settings
from app.core.database import session_scope
from app.models.session import Session
from app.models.transcript import Transcript
from app.models.whiteboard import WhiteboardLog

_CHARS_PER_TOKEN = 4


class ContextManager:
    """In-memory per-session buffer with a running token estimate.

    Feeds the compression trigger and the live token chip. The DB remains the
    source of truth for content (see get_context); this only tracks the
    not-yet-compressed window.
    """

    def __init__(self) -> None:
        self._buf: dict[str, dict] = {}

    def add(self, session_id: str, kind: str, text: str) -> int:
        b = self._buf.setdefault(session_id, {"items": [], "tokens": 0})
        b["items"].append({"kind": kind, "text": text})
        b["tokens"] += max(1, len(text) // _CHARS_PER_TOKEN)
        return b["tokens"]

    def tokens(self, session_id: str) -> int:
        return self._buf.get(session_id, {}).get("tokens", 0)

    def should_compress(self, session_id: str) -> bool:
        return self.tokens(session_id) >= settings.compression_token_limit

    def snapshot_text(self, session_id: str) -> str:
        items = self._buf.get(session_id, {}).get("items", [])
        return "\n".join(f"[{i['kind']}] {i['text']}" for i in items)

    def clear(self, session_id: str) -> None:
        self._buf[session_id] = {"items": [], "tokens": 0}


context_manager = ContextManager()


def get_context(session_id: str, n_transcripts: int = 30, n_boards: int = 5) -> str:
    sid = uuid.UUID(session_id)
    with session_scope() as db:
        transcripts = db.scalars(
            sa.select(Transcript)
            .where(Transcript.session_id == sid)
            .order_by(Transcript.timestamp.desc())
            .limit(n_transcripts)
        ).all()
        boards = db.scalars(
            sa.select(WhiteboardLog)
            .where(WhiteboardLog.session_id == sid, WhiteboardLog.ocr_text != "")
            .order_by(WhiteboardLog.timestamp.desc())
            .limit(n_boards)
        ).all()
        sess = db.get(Session, sid)
        compressed = list(sess.compressed_history) if sess and sess.compressed_history else []

    parts: list[str] = []
    if compressed:
        parts.append("[Earlier summary]\n" + json.dumps(compressed)[:2000])
    if boards:
        parts.append("[Whiteboard]\n" + "\n".join(b.ocr_text for b in reversed(boards)))
    if transcripts:
        parts.append("[Spoken]\n" + "\n".join(t.text for t in reversed(transcripts)))
    return "\n\n".join(parts) if parts else "(no lecture content captured yet)"
