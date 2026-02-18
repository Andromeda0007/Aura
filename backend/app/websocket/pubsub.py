import asyncio
import json
import structlog
from .connection import broadcast_to_session
from ..core.redis import get_redis

logger = structlog.get_logger()


class RedisPubSubManager:
    def __init__(self):
        self.subscribers = {}
        self.running = False

    async def start(self):
        self.running = True
        redis = await get_redis()
        
        pubsub = redis.pubsub()
        
        logger.info("PubSub manager started")
        
        while self.running:
            try:
                await pubsub.psubscribe("notifications:*", "responses:*")
                
                async for message in pubsub.listen():
                    if message["type"] == "pmessage":
                        await self.handle_message(message)
                        
            except Exception as e:
                logger.error("PubSub error", error=str(e))
                await asyncio.sleep(1)

    async def handle_message(self, message: dict):
        channel = message["channel"]
        data_str = message["data"]
        
        if channel.startswith("notifications:"):
            session_id = channel.split(":")[-1]
            data = json.loads(data_str)
            
            await broadcast_to_session(session_id, data["type"], data.get("data", {}))
        
        elif channel.startswith("responses:"):
            session_id = channel.split(":")[-1]
            data = json.loads(data_str)
            
            await broadcast_to_session(session_id, data["type"], data.get("data", {}))

    def stop(self):
        self.running = False
        logger.info("PubSub manager stopped")


pubsub_manager = RedisPubSubManager()
