from sqlalchemy import Column, String, Integer, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from ..core.database import Base


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject = Column(String(255), nullable=False)
    status = Column(Enum(SessionStatus), default=SessionStatus.ACTIVE, nullable=False, index=True)
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_time = Column(DateTime, nullable=True)
    compressed_history = Column(JSONB, default=list, nullable=False)
    active_buffer_tokens = Column(Integer, default=0, nullable=False)
    session_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    teacher = relationship("User", back_populates="sessions")
    transcripts = relationship("Transcript", back_populates="session", cascade="all, delete-orphan")
    whiteboard_logs = relationship("WhiteboardLog", back_populates="session", cascade="all, delete-orphan")
    fusion_events = relationship("FusionEvent", back_populates="session", cascade="all, delete-orphan")
    commands = relationship("Command", back_populates="session", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Session {self.id} - {self.subject}>"
