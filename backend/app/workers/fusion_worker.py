import asyncio
import json
from datetime import datetime, timedelta
from collections import deque
import structlog
from sqlalchemy.orm import Session

from ..core.redis import get_redis
from ..core.database import SessionLocal
from ..models import FusionEvent
from ..services.context_manager import ContextManager

logger = structlog.get_logger()


class FusionWorker:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.transcript_window = deque(maxlen=10)
        self.image_window = deque(maxlen=5)
        self.context_manager = ContextManager(session_id)
        self.running = False

    async def start(self):
        self.running = True
        logger.info("Fusion Worker started", session_id=self.session_id)
        
        redis = await get_redis()
        last_id = "0"
        
        while self.running:
            try:
                messages = await redis.xread(
                    {f"fusion_queue_{self.session_id}": last_id},
                    count=1,
                    block=1000,
                )
                
                if messages:
                    stream, msg_list = messages[0]
                    for msg_id, msg_data in msg_list:
                        await self.process_event(msg_data)
                        last_id = msg_id
                        
            except Exception as e:
                logger.error("Fusion Worker error", error=str(e), session_id=self.session_id)
                await asyncio.sleep(1)

    async def process_event(self, data: dict):
        event_type = data.get("type")
        
        if event_type == "transcript":
            await self.handle_transcript(data)
        elif event_type == "image":
            await self.handle_image(data)

    async def handle_transcript(self, data: dict):
        transcript_id = data.get("transcript_id")
        text = data.get("text")
        timestamp_str = data.get("timestamp")
        timestamp = datetime.fromisoformat(timestamp_str)
        
        self.transcript_window.append({
            "id": transcript_id,
            "text": text,
            "timestamp": timestamp,
        })
        
        await self.context_manager.add_content({
            "type": "transcript",
            "text": text,
            "timestamp": timestamp_str,
        })
        
        await self.attempt_fusion(transcript_id, text, timestamp)
        
        logger.debug("Transcript processed", session_id=self.session_id, text=text[:30])

    async def handle_image(self, data: dict):
        whiteboard_id = data.get("whiteboard_id")
        ocr_text = data.get("ocr_text")
        timestamp_str = data.get("timestamp")
        timestamp = datetime.fromisoformat(timestamp_str)
        
        self.image_window.append({
            "id": whiteboard_id,
            "ocr_text": ocr_text,
            "timestamp": timestamp,
        })
        
        if ocr_text:
            await self.context_manager.add_content({
                "type": "image",
                "text": ocr_text,
                "timestamp": timestamp_str,
            })
        
        logger.debug("Image processed", session_id=self.session_id, ocr=ocr_text[:30])

    async def attempt_fusion(self, transcript_id: str, text: str, timestamp: datetime):
        demonstrative_words = ["this", "here", "look at", "see", "observe", "notice", "as shown"]
        
        has_demonstrative = any(word in text.lower() for word in demonstrative_words)
        
        if not has_demonstrative:
            return
        
        for image in self.image_window:
            time_diff = abs((timestamp - image["timestamp"]).total_seconds())
            
            if time_diff <= 10:
                confidence = 0.8 if time_diff < 5 else 0.6
                
                db = SessionLocal()
                try:
                    fusion_event = FusionEvent(
                        session_id=self.session_id,
                        transcript_id=transcript_id,
                        whiteboard_id=image["id"],
                        relationship_type="explains",
                        confidence=confidence,
                        timestamp=timestamp,
                    )
                    db.add(fusion_event)
                    db.commit()
                    
                    logger.info(
                        "Fusion created",
                        session_id=self.session_id,
                        transcript_id=transcript_id,
                        whiteboard_id=image["id"],
                        confidence=confidence,
                    )
                finally:
                    db.close()
                
                break

    def stop(self):
        self.running = False
        logger.info("Fusion Worker stopped", session_id=self.session_id)


async def run_fusion_worker(session_id: str):
    worker = FusionWorker(session_id)
    await worker.start()
