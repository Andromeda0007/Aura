from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import secrets
from ..core.database import Base


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    command_id = Column(UUID(as_uuid=True), nullable=True)
    share_code = Column(String(10), unique=True, nullable=False, index=True)
    quiz_data = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    session = relationship("Session", back_populates="quizzes")

    @staticmethod
    def generate_share_code(length: int = 8) -> str:
        return secrets.token_urlsafe(length)[:length].upper()

    def __repr__(self):
        return f"<Quiz {self.id} - {self.share_code}>"
