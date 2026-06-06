import asyncio
import base64
import io
import json
import os
from datetime import datetime

import requests
import structlog

from ..core.database import SessionLocal
from ..core.config import get_settings
from ..models import WhiteboardLog

settings = get_settings()
logger = structlog.get_logger()

# Per-session last description cache — avoid spamming board_insight when board hasn't changed
_last_descriptions: dict = {}

_ocr_reader = None


def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        logger.info("Loading EasyOCR (fallback)...")
        import easyocr
        _ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        logger.info("EasyOCR loaded")
    return _ocr_reader


class VisionWorker:

    async def process_image(self, data: dict):
        def get(key):
            v = data.get(key) or data.get(key.encode() if isinstance(key, str) else key)
            return v.decode() if isinstance(v, bytes) else v

        session_id = get("session_id")
        image_data = get("image_data")
        tldraw_state = get("tldraw_state")
        page_number = int(get("page_number") or 1)
        timestamp = get("timestamp")

        if not session_id or not image_data:
            logger.warning("Missing session_id or image_data")
            return

        logger.info("Processing whiteboard", session=session_id[-8:], page=page_number)

        try:
            raw = image_data.split(",", 1)[1] if "," in image_data else image_data
            image_bytes = base64.b64decode(raw)
            logger.info("Image size", kb=f"{len(image_bytes)/1024:.1f}")

            loop = asyncio.get_event_loop()
            ocr_text = await loop.run_in_executor(
                None, lambda: self._describe_image(raw, image_bytes)
            )

            logger.info("Vision complete", session=session_id[-8:], preview=ocr_text[:80] if ocr_text else "(blank)")

            await self._save_to_db(session_id, tldraw_state, "", ocr_text, timestamp, page_number)

            # Emit board_insight if content is meaningful and changed from last time
            await self._maybe_emit_insight(session_id, ocr_text)

        except Exception as e:
            logger.error("Image processing failed", error=str(e), session_id=session_id)

    def _describe_image(self, image_b64: str, image_bytes: bytes) -> str:
        """Try Gemini Vision via REST first; fall back to EasyOCR."""
        if settings.GEMINI_API_KEY:
            try:
                return self._gemini_vision(image_b64)
            except Exception as e:
                logger.warning("Gemini Vision failed, falling back to EasyOCR", error=str(e))
        return self._run_ocr(image_bytes)

    def _gemini_vision(self, image_b64: str) -> str:
        """Call Gemini Vision via REST API — version-independent."""
        url = (
            "https://generativelanguage.googleapis.com/v1beta"
            f"/models/gemini-2.0-flash-lite:generateContent?key={settings.GEMINI_API_KEY}"
        )
        payload = {
            "contents": [{
                "parts": [
                    {
                        "text": (
                            "You are analyzing a classroom whiteboard screenshot. "
                            "Describe ALL visible content in detail: every word, equation, diagram, "
                            "drawing, label, arrow, and sketch you can see. "
                            "If the board is empty or has nothing meaningful, say 'Empty whiteboard'. "
                            "Be comprehensive — this description helps an AI teaching assistant "
                            "understand what the teacher is currently teaching."
                        )
                    },
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": image_b64,
                        }
                    },
                ]
            }],
            "generationConfig": {"maxOutputTokens": 512},
        }
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        return result["candidates"][0]["content"]["parts"][0]["text"].strip()

    def _run_ocr(self, image_bytes: bytes) -> str:
        try:
            import numpy as np
            from PIL import Image
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            image_np = np.array(image)
            reader = get_ocr_reader()
            results = reader.readtext(image_np, detail=0, paragraph=True)
            return " ".join(results).strip()
        except Exception as e:
            logger.error("OCR failed", error=str(e))
            return ""

    async def _maybe_emit_insight(self, session_id: str, description: str):
        """Broadcast board_insight to the session if content is new and non-trivial."""
        if not description or description.lower().startswith("empty whiteboard"):
            return

        last = _last_descriptions.get(session_id, "")

        # Simple change detection: emit if description differs by more than 30 chars
        if abs(len(description) - len(last)) < 30 and description[:60] == last[:60]:
            return

        _last_descriptions[session_id] = description

        try:
            from ..websocket.connection import broadcast_to_session
            await broadcast_to_session(session_id, "board_insight", {
                "description": description,
                "timestamp": datetime.utcnow().isoformat(),
            })
            logger.info("Board insight emitted", session=session_id[-8:])
        except Exception as e:
            logger.warning("Failed to emit board_insight", error=str(e))

    async def _save_to_db(self, session_id, tldraw_state, image_url, ocr_text, timestamp, page_number):
        db = SessionLocal()
        try:
            from ..models import Session as SessionModel
            session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            if not session:
                logger.warning("Session not in DB, skipping whiteboard log", session_id=session_id)
                return

            ts = datetime.utcnow()
            if timestamp:
                try:
                    ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                except Exception:
                    pass

            snapshot = {}
            if tldraw_state:
                try:
                    snapshot = json.loads(tldraw_state)
                except Exception:
                    pass

            log = WhiteboardLog(
                session_id=session_id,
                tldraw_snapshot=snapshot,
                image_url=image_url,
                ocr_text=ocr_text or "",
                timestamp=ts,
                page_number=page_number,
            )
            db.add(log)
            db.commit()
            logger.info("Whiteboard log saved", session_id=session_id,
                       ocr_preview=ocr_text[:60] if ocr_text else "(empty)")
        except Exception as e:
            logger.error("DB save failed for whiteboard", error=str(e)[:300])
        finally:
            db.close()

    def stop(self):
        pass
