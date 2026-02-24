"""
Context Manager — in-memory per-session buffer.
In-memory store. Resets on server restart (acceptable for demo).
"""
from typing import List, Dict
import structlog

from ..core.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

# In-memory store: { session_id: { "buffer": [...], "tokens": int } }
_store: Dict[str, dict] = {}


class ContextManager:
    TOKEN_LIMIT = settings.COMPRESSION_TOKEN_LIMIT
    CHARS_PER_TOKEN = 4

    def __init__(self, session_id: str):
        self.session_id = session_id
        if session_id not in _store:
            _store[session_id] = {"buffer": [], "tokens": 0}

    def _data(self) -> dict:
        return _store[self.session_id]

    async def add_content(self, content: Dict) -> int:
        d = self._data()
        d["buffer"].append(content)
        tokens = len(content.get("text", "")) // self.CHARS_PER_TOKEN
        d["tokens"] += tokens
        logger.info("Content added", session_id=self.session_id, tokens=d["tokens"], type=content.get("type"))
        return d["tokens"]

    async def get_active_buffer(self) -> List[Dict]:
        return self._data()["buffer"]

    async def get_token_count(self) -> int:
        return self._data()["tokens"]

    async def clear_buffer(self):
        _store[self.session_id] = {"buffer": [], "tokens": 0}
        logger.info("Buffer cleared", session_id=self.session_id)
