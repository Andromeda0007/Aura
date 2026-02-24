import asyncio
import structlog

from .llm_worker import LLMWorker
from .compression_worker import CompressionWorker

logger = structlog.get_logger()


class WorkerManager:
    def __init__(self):
        self.running = False

    async def start_all(self):
        if self.running:
            return
        self.running = True

        # STT and Vision workers are called directly per-request via asyncio.create_task()
        # Only LLM and Compression workers need background loops for command/context processing
        logger.info("✅ Worker manager ready (STT + Vision run per-request, no background loops)")

    async def stop_all(self):
        self.running = False
        logger.info("Worker manager stopped")


worker_manager = WorkerManager()
