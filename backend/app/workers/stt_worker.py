"""Speech-to-Text worker.

Two paths:
  * save_transcript_text  — browser Web Speech API sends finalized text (default path).
  * transcribe_audio      — raw audio chunks run through Whisper (faster-whisper),
                            lazy-loaded; no-ops gracefully if Whisper isn't installed.
Both persist a Transcript and broadcast `transcript_update` to the session room.
"""
from __future__ import annotations

import asyncio
import base64
import uuid
from datetime import datetime, timezone

from app.core.logging import get_logger
from app.core.database import session_scope
from app.models.transcript import Transcript
from app.websocket.connection import broadcast_to_session

logger = get_logger("aura.stt")

# Common Whisper hallucinations on silence/noise — dropped.
_NOISE = {
    "", "you", "thank you.", "thank you", "thanks for watching!", "thanks for watching.",
    "bye.", "bye", ".", "okay.", "so", "uh", "um",
}

_whisper_model = None  # lazy singleton


def is_noise(text: str) -> bool:
    return text.strip().lower() in _NOISE


async def _persist_and_broadcast(session_id: str, text: str, confidence: float) -> None:
    text = (text or "").strip()
    if not text:
        return
    ts = datetime.now(timezone.utc)
    with session_scope() as db:
        row = Transcript(
            session_id=uuid.UUID(session_id),
            text=text,
            confidence=confidence,
            is_processed=True,
            timestamp=ts,
        )
        db.add(row)
        db.flush()
        payload = {"id": str(row.id), "text": text, "timestamp": ts.isoformat(), "confidence": confidence}
    await broadcast_to_session(session_id, "transcript_update", payload)
    logger.info("stt.transcript_saved", session_id=session_id, chars=len(text))


async def save_transcript_text(session_id: str, text: str, confidence: float = 0.9) -> None:
    """Web Speech API path — text is already clean."""
    await _persist_and_broadcast(session_id, text, confidence)


def _get_whisper():
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        logger.warning("stt.whisper_unavailable", hint="pip install faster-whisper")
        return None
    # tiny/base are CPU-friendly; configurable later.
    _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    return _whisper_model


def _run_whisper(wav_bytes: bytes) -> str:
    model = _get_whisper()
    if model is None:
        return ""
    import io

    segments, _ = model.transcribe(io.BytesIO(wav_bytes), beam_size=1)
    return " ".join(seg.text.strip() for seg in segments).strip()


async def transcribe_audio(session_id: str, audio_b64: str) -> None:
    """Raw-audio path — decode base64 WAV, run Whisper in an executor, filter noise."""
    try:
        wav_bytes = base64.b64decode(audio_b64)
    except Exception:
        logger.warning("stt.bad_audio_payload", session_id=session_id)
        return
    loop = asyncio.get_running_loop()
    text = await loop.run_in_executor(None, _run_whisper, wav_bytes)
    if not text or is_noise(text):
        return
    await _persist_and_broadcast(session_id, text, confidence=0.85)
