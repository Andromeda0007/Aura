"""Shared enums for ORM models and schemas."""
from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    TEACHER = "teacher"
    STUDENT = "student"
    ADMIN = "admin"


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class CommandIntent(str, enum.Enum):
    GENERATE_QUIZ = "generate_quiz"
    SUMMARIZE = "summarize"
    EXPLAIN = "explain"
    GENERATE_EXAMPLE = "generate_example"
    GENERATE_DIAGRAM = "generate_diagram"
    ANSWER_QUESTION = "answer_question"
    FORMAT_BOARD = "format_board"
    OTHER = "other"


class CommandStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
