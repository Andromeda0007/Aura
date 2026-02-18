import asyncio
import json
from datetime import datetime
import structlog
from sqlalchemy.orm import Session

from ..core.redis import get_redis
from ..core.database import SessionLocal
from ..models import Session as SessionModel
from ..services.ai_service import ai_service
from ..services.context_manager import ContextManager

logger = structlog.get_logger()


class CompressionWorker:
    def __init__(self):
        self.running = False

    async def start(self):
        self.running = True
        logger.info("Compression Worker started")
        
        redis = await get_redis()
        last_id = "0"
        
        while self.running:
            try:
                messages = await redis.xread(
                    {"compression_queue": last_id},
                    count=1,
                    block=1000,
                )
                
                if messages:
                    stream, msg_list = messages[0]
                    for msg_id, msg_data in msg_list:
                        await self.process_compression(msg_data)
                        last_id = msg_id
                        
            except Exception as e:
                logger.error("Compression Worker error", error=str(e))
                await asyncio.sleep(1)

    async def process_compression(self, data: dict):
        session_id = data.get("session_id")
        buffer_content_str = data.get("buffer_content")
        trigger_reason = data.get("trigger_reason")
        
        logger.info("Processing compression", session_id=session_id, reason=trigger_reason)
        
        try:
            buffer = json.loads(buffer_content_str)
            
            redis = await get_redis()
            await redis.publish(
                f"notifications:{session_id}",
                json.dumps({
                    "type": "compression_started",
                    "data": {
                        "status": "started",
                        "message": "Compressing context buffer...",
                    },
                }),
            )
            
            try:
                compressed = await ai_service.compress_context(buffer)
                compression_method = "llm"
                
                logger.info("LLM compression successful", session_id=session_id)
            except Exception as e:
                logger.warning("LLM compression failed, using fallback", error=str(e), session_id=session_id)
                compressed = await ai_service._simple_compression(buffer)
                compression_method = "fallback"
                
                await redis.publish(
                    f"notifications:{session_id}",
                    json.dumps({
                        "type": "compression_fallback",
                        "data": {
                            "status": "started",
                            "method": "fallback",
                            "message": "Using simpler compression due to error",
                        },
                    }),
                )
            
            db = SessionLocal()
            try:
                session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
                if not session:
                    logger.error("Session not found", session_id=session_id)
                    return
                
                compressed_history = session.compressed_history or []
                
                segment = {
                    "segment_num": len(compressed_history) + 1,
                    "time_range": f"{datetime.utcnow().isoformat()}",
                    "token_count": 10000,
                    "compression_method": compression_method,
                    "summary": compressed,
                }
                compressed_history.append(segment)
                
                session.compressed_history = compressed_history
                session.active_buffer_tokens = 0
                db.commit()
                
                logger.info("Compression saved to database", session_id=session_id, segments=len(compressed_history))
            finally:
                db.close()
            
            context_manager = ContextManager(session_id)
            await context_manager.clear_buffer()
            
            await redis.publish(
                f"notifications:{session_id}",
                json.dumps({
                    "type": "compression_complete",
                    "data": {
                        "status": "complete",
                        "method": compression_method,
                        "segmentNum": len(compressed_history),
                        "message": "Context compressed successfully",
                    },
                }),
            )
            
            logger.info("Compression completed", session_id=session_id)
            
        except Exception as e:
            logger.error("Compression failed", error=str(e), session_id=session_id)
            
            redis = await get_redis()
            await redis.publish(
                f"notifications:{session_id}",
                json.dumps({
                    "type": "error",
                    "data": {
                        "status": "failed",
                        "message": "Compression failed",
                    },
                }),
            )

    def stop(self):
        self.running = False
        logger.info("Compression Worker stopped")


async def run_compression_worker():
    worker = CompressionWorker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(run_compression_worker())
