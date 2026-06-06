"""
STT Worker -- receives plain text from browser Web Speech API, saves to DB.
"""

import asyncio
import base64
import os
import re
import tempfile
from datetime import datetime

import whisper
import structlog

from ..core.database import SessionLocal
from ..core.config import get_settings
from ..models import Transcript

settings = get_settings()
logger = structlog.get_logger()

_whisper_model = None

HALLUCINATIONS = [
    r'^\[.*\]$', r'^\(.*\)$',
    r'^thanks for watching', r'^thank you',
    r'^subscribe', r'^[\W\s]+$',
]


def load_model():
    global _whisper_model
    if _whisper_model is None:
        logger.info("Loading Whisper base model...")
        _whisper_model = whisper.load_model("base")
        logger.info("Whisper ready")
    return _whisper_model


def is_noise(text: str) -> bool:
    t = text.strip().lower()
    if not t or len(t) < 3:
        return True
    for p in HALLUCINATIONS:
        if re.match(p, t, re.IGNORECASE):
            return True
    return len(re.findall(r'\b[a-zA-Z]{2,}\b', t)) == 0


class STTWorker:

    async def process_audio(self, data: dict):
        def get(k):
            v = data.get(k) or data.get(k.encode() if isinstance(k, str) else k)
            return v.decode() if isinstance(v, bytes) else v

        session_id = get("session_id")
        audio_data = get("data")
        chunk_id   = get("chunk_id") or "0"
        timestamp  = get("timestamp")
        sid        = get("sid")

        if not session_id or not audio_data:
            return

        logger.info("Audio chunk received", session_id=session_id, chunk=chunk_id)

        tmp_path = None
        try:
            audio_bytes = base64.b64decode(audio_data)
            size_kb = len(audio_bytes) / 1024
            logger.info("Audio size", kb=f"{size_kb:.0f}", session_id=session_id)

            if len(audio_bytes) < 5000:
                logger.warning("Too small, skipping", session_id=session_id)
                return

            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                f.write(audio_bytes)
                tmp_path = f.name

            model = load_model()
            loop  = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, lambda: model.transcribe(
                tmp_path,
                language="en",
                fp16=False,
                verbose=False,
                condition_on_previous_text=False,
                no_speech_threshold=0.6,
                temperature=0.0,
            ))

            text = result["text"].strip()
            if is_noise(text):
                logger.warning("Noise/silence filtered", text=repr(text))
                text = ""

            logger.info("--- TRANSCRIPT ---", chunk=chunk_id, session=session_id[-8:], text=text or "(silence)")

            if text:
                await self._save_db(session_id, text, timestamp)

                if sid:
                    try:
                        from ..websocket.connection import send_to_client
                        await send_to_client(sid, 'transcript_update', {
                            'id': f"t-{chunk_id}",
                            'text': text,
                            'timestamp': timestamp or datetime.utcnow().isoformat(),
                            'isFinal': True,
                        })
                    except Exception as e:
                        logger.error("WebSocket send failed", error=str(e))

        except Exception as e:
            logger.error("process_audio failed", error=str(e), session_id=session_id)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    async def save_transcript_text(self, data: dict):
        """Save plain text received directly from browser Web Speech API -- no Whisper needed."""
        session_id = data.get('session_id')
        text       = (data.get('text') or '').strip()
        timestamp  = data.get('timestamp')

        if not session_id or not text:
            return

        logger.info("Transcript saved", session=session_id[-8:], text=text[:80])

        await self._save_db(session_id, text, timestamp)

    async def _save_db(self, session_id: str, text: str, timestamp: str):
        db = SessionLocal()
        try:
            from ..models import Session as SessionModel
            if not db.query(SessionModel).filter(SessionModel.id == session_id).first():
                return
            ts = datetime.utcnow()
            if timestamp:
                try:
                    ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                except Exception:
                    pass
            db.add(Transcript(session_id=session_id, text=text,
                              timestamp=ts, confidence=0.9, is_processed=False))
            db.commit()
        except Exception as e:
            logger.error("DB save failed", error=str(e)[:200])
        finally:
            db.close()

    def stop(self):
        pass
