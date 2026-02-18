from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import secrets
from ..core.database import Base


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    command_id = Column(UUID(as_uuid=True), ForeignKey("commands.id", ondelete="CASCADE"), nullable=False)
    share_code = Column(String(10), unique=True, nullable=False, index=True)
    quiz_data = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    session = relationship("Session", back_populates="quizzes")
    command = relationship("Command", back_populates="quizzes")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")

    @staticmethod
    def generate_share_code(length: int = 8) -> str:
        return secrets.token_urlsafe(length)[:length].upper()

    def __repr__(self):
        return f"<Quiz {self.id} - {self.share_code}>"


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    student_name = Column(String(255), nullable=True)
    answers = Column(ARRAY(Integer), nullable=False)
    score = Column(Integer, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    quiz = relationship("Quiz", back_populates="attempts")

    def __repr__(self):
        return f"<QuizAttempt {self.id} - Score: {self.score}>"
