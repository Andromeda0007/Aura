"""Vision worker: store a board snapshot, OCR it, and surface board insights.

OCR provider order (best available): Groq vision -> Gemini vision -> EasyOCR.
The snapshot row is persisted BEFORE OCR so storage never depends on OCR success.
"""
from __future__ import annotations

import asyncio
import base64
import uuid
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.core.database import session_scope
from app.core.logging import get_logger
from app.models.whiteboard import WhiteboardLog
from app.websocket.connection import broadcast_to_session

logger = get_logger("aura.vision")

_OCR_PROMPT = (
    "Extract ALL text and equations from this whiteboard image, preserving line "
    "breaks. Return only the extracted text with no commentary. If empty, return nothing."
)

_last_ocr: dict[str, str] = {}


def _strip_data_url(data: str) -> str:
    return data.split(",", 1)[1] if data.startswith("data:") else data


async def _ocr_groq(b64: str) -> str:
    if not settings.groq_api_key:
        return ""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                    "temperature": 0,
                    "max_tokens": 512,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": _OCR_PROMPT},
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                            ],
                        }
                    ],
                },
            )
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"].strip()
        logger.warning("vision.groq_failed", status=r.status_code)
    except Exception as exc:  # noqa: BLE001
        logger.warning("vision.groq_error", error=str(exc))
    return ""


async def _ocr_gemini(b64: str) -> str:
    if not settings.gemini_api_key:
        return ""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-2.0-flash-lite:generateContent?key={settings.gemini_api_key}",
                json={
                    "contents": [
                        {
                            "parts": [
                                {"text": _OCR_PROMPT},
                                {"inline_data": {"mime_type": "image/png", "data": b64}},
                            ]
                        }
                    ]
                },
            )
        if r.status_code == 200:
            return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        logger.warning("vision.gemini_failed", status=r.status_code)
    except Exception as exc:  # noqa: BLE001
        logger.warning("vision.gemini_error", error=str(exc))
    return ""


_easyocr_reader = None


def _ocr_easyocr_sync(png_bytes: bytes) -> str:
    global _easyocr_reader
    try:
        import easyocr  # type: ignore
        import numpy as np
        from PIL import Image
        import io
    except ImportError:
        return ""
    if _easyocr_reader is None:
        _easyocr_reader = easyocr.Reader(["en"], gpu=False)
    img = np.array(Image.open(io.BytesIO(png_bytes)).convert("RGB"))
    return " ".join(_easyocr_reader.readtext(img, detail=0, paragraph=True)).strip()


async def _run_ocr(b64: str) -> str:
    text = await _ocr_groq(b64)
    if text:
        return text
    text = await _ocr_gemini(b64)
    if text:
        return text
    try:
        png = base64.b64decode(b64)
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _ocr_easyocr_sync, png)
    except Exception:  # noqa: BLE001
        return ""


async def process_snapshot(
    session_id: str,
    image_data: str,
    tldraw_snapshot: dict | None = None,
    page_number: int = 1,
) -> None:
    b64 = _strip_data_url(image_data or "")
    if not b64:
        return
    ts = datetime.now(timezone.utc)

    # 1) Persist the snapshot first (storage independent of OCR).
    with session_scope() as db:
        row = WhiteboardLog(
            session_id=uuid.UUID(session_id),
            tldraw_snapshot=tldraw_snapshot,
            image_data=b64,
            ocr_text="",
            page_number=page_number,
            timestamp=ts,
        )
        db.add(row)
        db.flush()
        row_id = row.id
    logger.info("vision.snapshot_saved", session_id=session_id, row_id=str(row_id))

    # 2) OCR (best effort) and update the row.
    ocr = await _run_ocr(b64)
    if not ocr:
        return
    with session_scope() as db:
        row = db.get(WhiteboardLog, row_id)
        if row:
            row.ocr_text = ocr

    # 3) Surface a board insight when the content meaningfully changed.
    last = _last_ocr.get(session_id, "")
    if abs(len(ocr) - len(last)) > 30 or (ocr and ocr not in last):
        _last_ocr[session_id] = ocr
        await broadcast_to_session(
            session_id, "board_insight", {"description": ocr[:500], "timestamp": ts.isoformat()}
        )
    logger.info("vision.ocr_done", session_id=session_id, chars=len(ocr))
