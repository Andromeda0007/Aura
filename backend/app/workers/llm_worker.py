"""LLM worker — process a user command end to end.

Create a Command row, classify intent, assemble fused context, execute the
intent, persist the response (+ Quiz for quizzes), and broadcast command_response.
"""
from __future__ import annotations

import time
import uuid

from app.core.logging import get_logger
from app.core.database import session_scope
from app.models.command import Command
from app.models.enums import CommandIntent, CommandStatus
from app.models.quiz import Quiz
from app.models.session import Session
from app.services.ai_service import ai_service
from app.services.command_payload import response_type_for
from app.services.context_manager import get_context
from app.websocket.connection import broadcast_to_session

logger = get_logger("aura.llm")

_WAKE = "hey aura"


def _strip_wake(raw: str) -> str:
    low = raw.lower()
    idx = low.find(_WAKE)
    if idx != -1:
        rest = raw[idx + len(_WAKE):].strip(" ,.:!?")
        return rest or raw
    return raw


async def process_command(session_id: str, raw_command: str) -> None:
    start = time.time()
    command = _strip_wake(raw_command)
    ai_service.reset_tokens()  # count LLM tokens for this command (classify + generate)

    with session_scope() as db:
        row = Command(
            session_id=uuid.UUID(session_id),
            raw_command=raw_command,
            status=CommandStatus.PROCESSING,
        )
        db.add(row)
        db.flush()
        command_id = row.id

    intent = await ai_service.classify_intent(command)
    context = get_context(session_id)
    with session_scope() as db:
        sess = db.get(Session, uuid.UUID(session_id))
        language = sess.language if sess else "English"
    logger.info("llm.classified", session_id=session_id, intent=intent.value, command=command[:60])

    data: dict
    response_type = response_type_for(intent)
    status = CommandStatus.COMPLETED
    error: str | None = None

    try:
        if intent == CommandIntent.GENERATE_QUIZ:
            data = await ai_service.generate_quiz(context, language=language)
            if "questions" in data:
                with session_scope() as db:
                    quiz = Quiz(session_id=uuid.UUID(session_id), command_id=command_id, quiz_data=data)
                    db.add(quiz)
                    db.flush()
                    data = {**data, "shareCode": quiz.share_code}
        elif intent == CommandIntent.SUMMARIZE:
            data = await ai_service.summarize(context, language=language)
        elif intent == CommandIntent.EXPLAIN:
            data = await ai_service.explain(context, command, language=language)
        elif intent == CommandIntent.GENERATE_EXAMPLE:
            data = await ai_service.generate_example(context, command, language=language)
        elif intent == CommandIntent.GENERATE_DIAGRAM:
            data = await ai_service.generate_diagram(context, command, language=language)
        elif intent == CommandIntent.GENERATE_FACT:
            data = await ai_service.generate_fact(context, command, language=language)
        elif intent == CommandIntent.LIST_ITEMS:
            data = await ai_service.list_items(context, command, language=language)
        elif intent == CommandIntent.GENERATE_NUMERICAL:
            data = await ai_service.generate_numerical(context, command, language=language)
        elif intent == CommandIntent.GENERATE_IMAGE:
            data = await ai_service.generate_image(command, language=language)
        elif intent == CommandIntent.GENERATE_CHEMISTRY:
            data = await ai_service.generate_chemistry(command, language=language)
        elif intent == CommandIntent.FORMAT_BOARD:
            data = await ai_service.format_board(context)
        else:  # ANSWER_QUESTION and OTHER both answer the query
            data = await ai_service.answer_question(context, command, language=language)
    except Exception as exc:  # noqa: BLE001
        logger.error("llm.execute_failed", error=str(exc), intent=intent.value)
        data, status, error = {"error": "Generation failed. Please try again."}, CommandStatus.FAILED, str(exc)

    ms = int((time.time() - start) * 1000)
    with session_scope() as db:
        row = db.get(Command, command_id)
        if row:
            row.intent = intent
            row.llm_response = data
            row.status = status
            row.processing_time_ms = ms
            row.tokens_used = ai_service.tokens_used()
            row.error_message = error

    await broadcast_to_session(
        session_id,
        "command_response",
        {
            "type": response_type,
            "data": data,
            "commandId": str(command_id),
            "command": command,
            "processingTime": ms,
        },
    )
    logger.info("llm.responded", session_id=session_id, intent=intent.value, ms=ms)
