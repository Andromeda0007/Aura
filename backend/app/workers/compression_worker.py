"""Compression worker — summarize the live buffer into compressed_history.

Auto-triggered when the ContextManager buffer crosses the token limit.
Emits compression_started / compression_complete for the UI token chip.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.core.logging import get_logger
from app.core.database import session_scope
from app.models.session import Session
from app.services.ai_service import ai_service
from app.services.context_manager import context_manager
from app.websocket.connection import broadcast_to_session

logger = get_logger("aura.compression")


async def maybe_compress(session_id: str) -> None:
    if context_manager.should_compress(session_id):
        await run_compression(session_id)


async def run_compression(session_id: str) -> None:
    text = context_manager.snapshot_text(session_id)
    if not text.strip():
        return

    token_count = context_manager.tokens(session_id)
    await broadcast_to_session(
        session_id, "compression_started", {"status": "started", "message": "Compressing context…"}
    )

    summary = await ai_service.compress_context(text)
    method = "fallback" if summary.pop("_fallback", False) else "llm"

    segment_num = 0
    with session_scope() as db:
        sess = db.get(Session, uuid.UUID(session_id))
        if sess is not None:
            history = list(sess.compressed_history or [])
            segment_num = len(history) + 1
            history.append(
                {
                    "segment_num": segment_num,
                    "time_range": datetime.now(timezone.utc).isoformat(),
                    "token_count": token_count,
                    "compression_method": method,
                    "summary": summary,
                }
            )
            sess.compressed_history = history
            sess.active_buffer_tokens = 0

    context_manager.clear(session_id)
    await broadcast_to_session(
        session_id,
        "compression_complete",
        {"status": "complete", "method": method, "segmentNum": segment_num},
    )
    logger.info("compression.done", session_id=session_id, method=method, segment=segment_num)
