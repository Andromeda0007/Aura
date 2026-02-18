from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..core.database import Base


class WhiteboardLog(Base):
    __tablename__ = "whiteboard_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    tldraw_snapshot = Column(JSONB, nullable=False)
    image_url = Column(String(500), nullable=False)
    ocr_text = Column(Text, nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    page_number = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("Session", back_populates="whiteboard_logs")
    fusion_events = relationship("FusionEvent", back_populates="whiteboard", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<WhiteboardLog {self.id} - Page {self.page_number}>"
