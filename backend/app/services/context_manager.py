import json
from typing import List, Dict, Optional
from datetime import datetime
import structlog

from ..core.redis import get_redis
from ..core.config import get_settings

settings = get_settings()
logger = structlog.get_logger()


class ContextManager:
    TOKEN_LIMIT = settings.COMPRESSION_TOKEN_LIMIT
    CHARS_PER_TOKEN = 4

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.buffer_key = f"active_buffer:{session_id}"
        self.token_key = f"token_count:{session_id}"

    async def add_content(self, content: Dict) -> int:
        redis = await get_redis()
        
        await redis.rpush(self.buffer_key, json.dumps(content))
        
        text_length = len(content.get("text", ""))
        estimated_tokens = text_length // self.CHARS_PER_TOKEN
        new_count = await redis.incrby(self.token_key, estimated_tokens)
        
        logger.info(
            "Content added to buffer",
            session_id=self.session_id,
            tokens=new_count,
            content_type=content.get("type"),
        )
        
        if new_count >= self.TOKEN_LIMIT:
            logger.warning(
                "Token limit reached",
                session_id=self.session_id,
                tokens=new_count,
            )
            await self._trigger_compression()
        
        return new_count

    async def _trigger_compression(self):
        redis = await get_redis()
        
        buffer_json = await redis.lrange(self.buffer_key, 0, -1)
        buffer = [json.loads(item) for item in buffer_json]
        
        await redis.xadd(
            "compression_queue",
            {
                "session_id": self.session_id,
                "buffer_content": json.dumps(buffer),
                "trigger_reason": "token_limit",
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        
        await redis.publish(
            f"notifications:{self.session_id}",
            json.dumps({
                "type": "compression_starting",
                "message": "Context buffer full, compressing..."
            }),
        )
        
        logger.info("Compression triggered", session_id=self.session_id)

    async def get_active_buffer(self) -> List[Dict]:
        redis = await get_redis()
        buffer_json = await redis.lrange(self.buffer_key, 0, -1)
        return [json.loads(item) for item in buffer_json]

    async def clear_buffer(self):
        redis = await get_redis()
        await redis.delete(self.buffer_key)
        await redis.set(self.token_key, 0)
        
        logger.info("Buffer cleared", session_id=self.session_id)

    async def get_token_count(self) -> int:
        redis = await get_redis()
        count = await redis.get(self.token_key)
        return int(count) if count else 0
