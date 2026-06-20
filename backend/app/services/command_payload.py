"""Single source of truth: CommandIntent -> frontend response `type` string.

Imported by the LLM worker (live broadcast) and the history/library replay
routers so the three never drift apart.
"""
from __future__ import annotations

from app.models.enums import CommandIntent

INTENT_RESPONSE_TYPE: dict[CommandIntent, str] = {
    CommandIntent.GENERATE_QUIZ: "quiz",
    CommandIntent.SUMMARIZE: "summary",
    CommandIntent.EXPLAIN: "explanation",
    CommandIntent.GENERATE_EXAMPLE: "example",
    CommandIntent.GENERATE_DIAGRAM: "diagram",
    CommandIntent.GENERATE_FACT: "fact",
    CommandIntent.LIST_ITEMS: "list",
    CommandIntent.GENERATE_IMAGE: "image",
    CommandIntent.GENERATE_NUMERICAL: "numerical",
    CommandIntent.GENERATE_CHEMISTRY: "chemistry",
    CommandIntent.ANSWER_QUESTION: "answer",
    CommandIntent.FORMAT_BOARD: "format_board",
    CommandIntent.OTHER: "answer",
}


def response_type_for(intent: CommandIntent | str) -> str:
    """Map an intent (enum or its value string) to the frontend response `type`."""
    if isinstance(intent, str):
        try:
            intent = CommandIntent(intent)
        except ValueError:
            return "answer"
    return INTENT_RESPONSE_TYPE.get(intent, "answer")
