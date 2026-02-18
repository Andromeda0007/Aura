import asyncio
import json
from datetime import datetime
import structlog
from sqlalchemy.orm import Session
import time

from ..core.redis import get_redis
from ..core.database import SessionLocal
from ..models import Command, CommandIntent, CommandStatus, Session as SessionModel, Quiz
from ..services.ai_service import ai_service
from ..services.context_manager import ContextManager

logger = structlog.get_logger()


class LLMWorker:
    def __init__(self):
        self.running = False

    async def start(self):
        self.running = True
        logger.info("LLM Worker started")
        
        redis = await get_redis()
        
        while self.running:
            try:
                streams = {}
                keys = await redis.keys("command_queue_*")
                
                for key in keys:
                    streams[key] = "0"
                
                if not streams:
                    await asyncio.sleep(1)
                    continue
                
                messages = await redis.xread(streams, count=1, block=1000)
                
                if messages:
                    for stream, msg_list in messages:
                        for msg_id, msg_data in msg_list:
                            await self.process_command(msg_data)
                            
            except Exception as e:
                logger.error("LLM Worker error", error=str(e))
                await asyncio.sleep(1)

    async def process_command(self, data: dict):
        session_id = data.get("session_id")
        command_text = data.get("command")
        timestamp_str = data.get("timestamp")
        sid = data.get("sid")
        
        logger.info("Processing command", session_id=session_id, command=command_text[:50])
        
        start_time = time.time()
        
        try:
            intent_str = await ai_service.classify_intent(command_text)
            intent = CommandIntent(intent_str)
            
            db = SessionLocal()
            try:
                command = Command(
                    session_id=session_id,
                    raw_command=command_text,
                    intent=intent,
                    status=CommandStatus.PROCESSING,
                    timestamp=datetime.fromisoformat(timestamp_str),
                )
                db.add(command)
                db.commit()
                db.refresh(command)
                command_id = str(command.id)
            finally:
                db.close()
            
            context = await self.get_context(session_id)
            
            response_data = await self.execute_intent(intent, context, command_text, session_id)
            
            processing_time = int((time.time() - start_time) * 1000)
            
            db = SessionLocal()
            try:
                command = db.query(Command).filter(Command.id == command_id).first()
                command.llm_response = response_data
                command.status = CommandStatus.COMPLETED
                command.processing_time_ms = processing_time
                db.commit()
            finally:
                db.close()
            
            redis = await get_redis()
            await redis.publish(
                f"responses:{session_id}",
                json.dumps({
                    "type": "command_response",
                    "data": {
                        "type": intent.value if intent != CommandIntent.GENERATE_QUIZ else "quiz",
                        "data": response_data,
                        "commandId": command_id,
                        "processingTime": processing_time,
                    },
                }),
            )
            
            logger.info("Command completed", session_id=session_id, intent=intent.value, time=processing_time)
            
        except Exception as e:
            logger.error("Command processing failed", error=str(e), session_id=session_id)
            
            db = SessionLocal()
            try:
                if 'command_id' in locals():
                    command = db.query(Command).filter(Command.id == command_id).first()
                    if command:
                        command.status = CommandStatus.FAILED
                        command.error_message = str(e)
                        db.commit()
            finally:
                db.close()

    async def get_context(self, session_id: str) -> str:
        db = SessionLocal()
        try:
            session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            if not session:
                return ""
            
            compressed_history = session.compressed_history or []
            
            context_manager = ContextManager(session_id)
            active_buffer = await context_manager.get_active_buffer()
            
            history_text = ""
            for segment in compressed_history:
                summary = segment.get("summary", {})
                history_text += f"\n--- Segment {segment.get('segment_num')} ---\n"
                history_text += f"Topics: {', '.join(summary.get('topicFlow', []))}\n"
                for concept, definition in summary.get('keyConcepts', {}).items():
                    history_text += f"- {concept}: {definition}\n"
            
            active_text = ""
            for item in active_buffer:
                if item.get("type") == "transcript":
                    active_text += f"{item.get('text')} "
                elif item.get("type") == "image":
                    active_text += f"[Drawing: {item.get('text', 'visual content')}] "
            
            return f"{history_text}\n\nRECENT CONTEXT:\n{active_text}"
        finally:
            db.close()

    async def execute_intent(self, intent: CommandIntent, context: str, command: str, session_id: str) -> dict:
        if intent == CommandIntent.GENERATE_QUIZ:
            quiz_data = await ai_service.generate_quiz(context, command)
            
            db = SessionLocal()
            try:
                quiz = Quiz(
                    session_id=session_id,
                    command_id=None,
                    share_code=Quiz.generate_share_code(),
                    quiz_data=quiz_data,
                )
                db.add(quiz)
                db.commit()
                db.refresh(quiz)
                
                quiz_data["shareCode"] = quiz.share_code
                quiz_data["quizId"] = str(quiz.id)
            finally:
                db.close()
            
            return quiz_data
        
        elif intent == CommandIntent.SUMMARIZE:
            return await ai_service.generate_summary(context)
        
        elif intent == CommandIntent.EXPLAIN:
            return await ai_service.explain_concept(context, command)
        
        elif intent == CommandIntent.GENERATE_EXAMPLE:
            return await ai_service.generate_example(context, command)
        
        elif intent == CommandIntent.ANSWER_QUESTION:
            return await ai_service.explain_concept(context, command)
        
        else:
            return {"content": "I don't understand that command. Try asking for a quiz, summary, or explanation."}

    def stop(self):
        self.running = False
        logger.info("LLM Worker stopped")


async def run_llm_worker():
    worker = LLMWorker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(run_llm_worker())
