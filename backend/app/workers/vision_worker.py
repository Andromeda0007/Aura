import asyncio
import base64
import io
import json
import os
from datetime import datetime

import structlog
import numpy as np
from PIL import Image

from ..core.database import SessionLocal
from ..core.config import get_settings
from ..models import WhiteboardLog
from ..services.storage_service import storage_service

settings = get_settings()
logger = structlog.get_logger()

_ocr_reader = None


def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        logger.info("Loading EasyOCR...")
        import easyocr
        _ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        logger.info("✅ EasyOCR loaded")
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

        logger.info(f"📸 Processing whiteboard | Session: {session_id[-8:]} | Page: {page_number}")

        try:
            raw = image_data.split(",", 1)[1] if "," in image_data else image_data
            image_bytes = base64.b64decode(raw)
            logger.info(f"Image size: {len(image_bytes)/1024:.1f} KB", session_id=session_id)

            # Save PNG to disk
            image_url = await storage_service.upload_image(session_id, image_data, page_number)
            if not image_url:
                logger.error("Failed to save image", session_id=session_id)
                return

            logger.info(f"✅ Image saved: {image_url}", session_id=session_id)

            # Run OCR off the event loop (CPU-bound)
            loop = asyncio.get_event_loop()
            ocr_text = await loop.run_in_executor(None, lambda: self._run_ocr(image_bytes))

            logger.info("=" * 60)
            logger.info(f"🖼️  OCR | Session: {session_id[-8:]}")
            logger.info(f"📝 OCR TEXT: {ocr_text or '(blank canvas)'}")
            logger.info("=" * 60)

            await self._save_to_db(session_id, tldraw_state, image_url, ocr_text, timestamp, page_number)

        except Exception as e:
            logger.error("Image processing failed", error=str(e), session_id=session_id)

    def _run_ocr(self, image_bytes: bytes) -> str:
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            image_np = np.array(image)
            reader = get_ocr_reader()
            results = reader.readtext(image_np, detail=0, paragraph=True)
            return " ".join(results).strip()
        except Exception as e:
            logger.error("OCR failed", error=str(e))
            return ""

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
            logger.info("✅ Whiteboard log saved to DB", session_id=session_id,
                       ocr_preview=ocr_text[:60] if ocr_text else "(empty)")
        except Exception as e:
            logger.error("DB save failed for whiteboard", error=str(e)[:300])
        finally:
            db.close()

    def stop(self):
        pass
