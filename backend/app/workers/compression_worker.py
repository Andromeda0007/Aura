"""
Compression Worker — compresses session context when token limit is reached.
Triggered directly via asyncio.create_task(). Sends notifications via WebSocket.
"""
import json
from datetime import datetime
import structlog

from ..core.database import SessionLocal
from ..models import Session as SessionModel
from ..services.ai_service import ai_service
from ..services.context_manager import ContextManager

logger = structlog.get_logger()


class CompressionWorker:

    async def process_compression(self, session_id: str, sid: str = None):
        logger.info("Processing compression", session_id=session_id)

        from ..websocket.connection import send_to_client, broadcast_to_session

        async def notify(event_type: str, data: dict):
            if sid:
                await send_to_client(sid, event_type, data)
            else:
                await broadcast_to_session(session_id, event_type, data)

        await notify('compression_started', {'status': 'started', 'message': 'Compressing context...'})

        try:
            context_manager = ContextManager(session_id)
            buffer = await context_manager.get_active_buffer()

            try:
                compressed = await ai_service.compress_context(buffer)
                method = "llm"
            except Exception as e:
                logger.warning("LLM compression failed, using fallback", error=str(e))
                compressed = await ai_service._simple_compression(buffer)
                method = "fallback"

            db = SessionLocal()
            try:
                session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
                if not session:
                    return
                history = session.compressed_history or []
                history.append({
                    "segment_num": len(history) + 1,
                    "time_range": datetime.utcnow().isoformat(),
                    "token_count": 10000,
                    "compression_method": method,
                    "summary": compressed,
                })
                session.compressed_history = history
                session.active_buffer_tokens = 0
                db.commit()
                seg_count = len(history)
            finally:
                db.close()

            await context_manager.clear_buffer()

            await notify('compression_complete', {
                'status': 'complete',
                'method': method,
                'segmentNum': seg_count,
                'message': 'Context compressed successfully',
            })

            logger.info("Compression done", session_id=session_id, segments=seg_count)

        except Exception as e:
            logger.error("Compression failed", error=str(e), session_id=session_id)
            await notify('error', {'message': 'Compression failed'})

    def stop(self):
        pass
