"""
STT Worker -- receives plain text from browser Web Speech API, saves to DB.
"""

from datetime import datetime
import structlog

from ..core.database import SessionLocal
from ..models import Transcript

logger = structlog.get_logger()


class STTWorker:

    async def save_transcript_text(self, data: dict):
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
