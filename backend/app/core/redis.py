import redis.asyncio as redis
from typing import Optional
from .config import get_settings

settings = get_settings()

_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global _redis_client
    
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
        )
    
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
