"""Socket.IO data-event handlers. Session id is taken from the authenticated
connection (active_connections), never trusted from client payloads."""
from __future__ import annotations

import asyncio

from app.core.logging import get_logger
from app.websocket.connection import active_connections, sio
from app.workers.stt_worker import save_transcript_text, transcribe_audio

logger = get_logger("aura.ws.handlers")


def _session_for(sid: str) -> str | None:
    info = active_connections.get(sid)
    return info["session_id"] if info else None


@sio.on("transcript_text")
async def handle_transcript_text(sid: str, data: dict) -> None:
    session_id = _session_for(sid)
    if not session_id:
        return
    text = (data or {}).get("text", "")
    if text.strip():
        asyncio.create_task(save_transcript_text(session_id, text))


@sio.on("audio_chunk")
async def handle_audio_chunk(sid: str, data: dict) -> None:
    session_id = _session_for(sid)
    if not session_id:
        return
    audio = (data or {}).get("data") or (data or {}).get("audio")
    if audio:
        asyncio.create_task(transcribe_audio(session_id, audio))
