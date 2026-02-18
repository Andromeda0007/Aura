from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..core.database import Base


class FusionEvent(Base):
    __tablename__ = "fusion_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    transcript_id = Column(UUID(as_uuid=True), ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False)
    whiteboard_id = Column(UUID(as_uuid=True), ForeignKey("whiteboard_logs.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("Session", back_populates="fusion_events")
    transcript = relationship("Transcript", back_populates="fusion_events")
    whiteboard = relationship("WhiteboardLog", back_populates="fusion_events")

    def __repr__(self):
        return f"<FusionEvent {self.id} - {self.relationship_type}>"
