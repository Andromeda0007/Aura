from sqlalchemy import Column, String, Integer, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from ..core.database import Base


class CommandIntent(str, enum.Enum):
    GENERATE_QUIZ = "generate_quiz"
    SUMMARIZE = "summarize"
    EXPLAIN = "explain"
    GENERATE_EXAMPLE = "generate_example"
    ANSWER_QUESTION = "answer_question"
    OTHER = "other"


class CommandStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Command(Base):
    __tablename__ = "commands"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    raw_command = Column(Text, nullable=False)
    intent = Column(Enum(CommandIntent), nullable=False)
    llm_response = Column(JSONB, nullable=True)
    status = Column(Enum(CommandStatus), default=CommandStatus.PENDING, nullable=False)
    processing_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("Session", back_populates="commands")

    def __repr__(self):
        return f"<Command {self.id} - {self.intent}>"
