import asyncio
import json
from datetime import datetime
import structlog
import time

from ..core.database import SessionLocal
from ..models import Command, CommandIntent, CommandStatus, Session as SessionModel, Quiz
from ..services.ai_service import ai_service

logger = structlog.get_logger()


class LLMWorker:

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
                ts = datetime.utcnow()
                if timestamp_str:
                    try: ts = datetime.fromisoformat(timestamp_str)
                    except Exception: pass
                command = Command(
                    session_id=session_id,
                    raw_command=command_text,
                    intent=intent,
                    status=CommandStatus.PROCESSING,
                    timestamp=ts,
                )
                db.add(command)
                db.commit()
                db.refresh(command)
                command_id = str(command.id)
            finally:
                db.close()

            context = await self._get_context(session_id)
            response_data = await self._execute_intent(intent, context, command_text, session_id, command_id)

            processing_time = int((time.time() - start_time) * 1000)

            db = SessionLocal()
            try:
                cmd = db.query(Command).filter(Command.id == command_id).first()
                if cmd:
                    cmd.llm_response = response_data
                    cmd.status = CommandStatus.COMPLETED
                    cmd.processing_time_ms = processing_time
                    db.commit()
            finally:
                db.close()

            # Map backend intents to frontend-expected type names
            type_map = {
                CommandIntent.GENERATE_QUIZ:    'quiz',
                CommandIntent.SUMMARIZE:        'summary',
                CommandIntent.EXPLAIN:          'explanation',
                CommandIntent.GENERATE_EXAMPLE: 'example',
                CommandIntent.ANSWER_QUESTION:  'answer',
                CommandIntent.OTHER:            'answer',
            }
            response_type = type_map.get(intent, 'answer')

            # Send directly via WebSocket
            if sid:
                from ..websocket.connection import send_to_client
                await send_to_client(sid, 'command_response', {
                    'type': response_type,
                    'data': response_data,
                    'commandId': command_id,
                    'processingTime': processing_time,
                })

            logger.info("Command completed", session_id=session_id, intent=intent.value, ms=processing_time)

        except Exception as e:
            logger.error("Command processing failed", error=str(e), session_id=session_id)
            if sid:
                from ..websocket.connection import send_to_client
                await send_to_client(sid, 'error', {'message': 'Command processing failed'})

    async def _get_context(self, session_id: str) -> str:
        """Build context from DB: compressed history + recent transcripts."""
        db = SessionLocal()
        try:
            session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            if not session:
                return ""

            # Compressed history
            history_text = ""
            for seg in (session.compressed_history or []):
                summary = seg.get("summary", {})
                history_text += f"\n--- Segment {seg.get('segment_num')} ---\n"
                history_text += f"Topics: {', '.join(summary.get('topicFlow', []))}\n"
                for concept, definition in summary.get('keyConcepts', {}).items():
                    history_text += f"- {concept}: {definition}\n"

            # Recent transcripts from DB (last 30)
            from ..models import Transcript, WhiteboardLog
            recent = (db.query(Transcript)
                      .filter(Transcript.session_id == session_id)
                      .order_by(Transcript.timestamp.desc())
                      .limit(30).all())
            recent_text = " ".join(t.text for t in reversed(recent))

            # Recent whiteboard OCR text (last 5 snapshots)
            whiteboard_logs = (db.query(WhiteboardLog)
                               .filter(WhiteboardLog.session_id == session_id)
                               .order_by(WhiteboardLog.timestamp.desc())
                               .limit(5).all())
            ocr_text = " | ".join(
                w.ocr_text for w in reversed(whiteboard_logs) if w.ocr_text
            )

            context = f"{history_text}\n\nRECENT TRANSCRIPT:\n{recent_text}"
            if ocr_text:
                context += f"\n\nWHITEBOARD CONTENT (OCR):\n{ocr_text}"
            return context
        finally:
            db.close()

    async def _execute_intent(self, intent: CommandIntent, context: str, command: str, session_id: str, command_id: str = None) -> dict:
        if intent == CommandIntent.GENERATE_QUIZ:
            quiz_data = await ai_service.generate_quiz(context, command)
            db = SessionLocal()
            try:
                quiz = Quiz(session_id=session_id, command_id=command_id,
                            share_code=Quiz.generate_share_code(), quiz_data=quiz_data)
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
        elif intent in (CommandIntent.EXPLAIN, CommandIntent.ANSWER_QUESTION):
            return await ai_service.explain_concept(context, command)
        elif intent == CommandIntent.GENERATE_EXAMPLE:
            return await ai_service.generate_example(context, command)
        else:
            return {"content": "I don't understand that command. Try asking for a quiz, summary, or explanation."}

    def stop(self):
        pass
