from sqlalchemy import Column, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..core.database import Base


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    confidence = Column(Float, nullable=True)
    is_processed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("Session", back_populates="transcripts")
    fusion_events = relationship("FusionEvent", back_populates="transcript", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Transcript {self.id} - {self.text[:50]}...>"
