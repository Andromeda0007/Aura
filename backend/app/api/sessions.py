from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator, Field, ConfigDict
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_teacher
from ..models import User, Session as SessionModel, SessionStatus, Command, Transcript

router = APIRouter()


class CreateSessionRequest(BaseModel):
    subject: str
    metadata: Optional[dict] = None


class UpdateSessionRequest(BaseModel):
    subject: Optional[str] = None
    status: Optional[SessionStatus] = None


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: str
    teacher_id: str = Field(..., serialization_alias='teacherId')
    subject: str
    status: str
    start_time: datetime = Field(..., serialization_alias='startTime')
    end_time: Optional[datetime] = Field(None, serialization_alias='endTime')
    active_buffer_tokens: int = Field(..., serialization_alias='activeBufferTokens')
    created_at: datetime = Field(..., serialization_alias='createdAt')
    
    @field_validator('id', 'teacher_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v


class SessionDetailResponse(SessionResponse):
    compressed_history: List[dict] = Field(..., serialization_alias='compressedHistory')
    session_metadata: Optional[dict] = Field(None, serialization_alias='metadata')


class PaginatedSessionsResponse(BaseModel):
    items: List[SessionResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: CreateSessionRequest,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    new_session = SessionModel(
        teacher_id=current_user.id,
        subject=request.subject,
        status=SessionStatus.ACTIVE,
        metadata=request.metadata,
    )
    
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return SessionResponse.model_validate(new_session)


@router.get("", response_model=PaginatedSessionsResponse)
async def get_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    query = db.query(SessionModel).filter(SessionModel.teacher_id == current_user.id)
    
    total = query.count()
    sessions = query.order_by(SessionModel.start_time.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return PaginatedSessionsResponse(
        items=[SessionResponse.model_validate(s) for s in sessions],
        total=total,
        page=page,
        page_size=page_size,
        has_more=total > page * page_size,
    )


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: UUID,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.teacher_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    return SessionDetailResponse.model_validate(session)


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: UUID,
    request: UpdateSessionRequest,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.teacher_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    if request.subject is not None:
        session.subject = request.subject
    if request.status is not None:
        session.status = request.status
    
    db.commit()
    db.refresh(session)
    
    return SessionResponse.model_validate(session)


@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: UUID,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.teacher_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    session.status = SessionStatus.COMPLETED
    session.end_time = datetime.utcnow()
    
    db.commit()
    db.refresh(session)
    
    return SessionResponse.model_validate(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.teacher_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    db.delete(session)
    db.commit()


@router.get("/{session_id}/transcripts")
async def get_session_transcripts(
    session_id: UUID,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.teacher_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    transcripts = (
        db.query(Transcript)
        .filter(Transcript.session_id == session_id)
        .order_by(Transcript.timestamp)
        .all()
    )

    return [
        {
            "id": str(t.id),
            "text": t.text,
            "timestamp": t.timestamp.isoformat(),
        }
        for t in transcripts
    ]


@router.get("/{session_id}/commands")
async def get_session_commands(
    session_id: UUID,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db)
):
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.teacher_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    commands = db.query(Command).filter(Command.session_id == session_id).order_by(Command.timestamp.desc()).all()
    
    return [
        {
            "id": str(cmd.id),
            "raw_command": cmd.raw_command,
            "intent": cmd.intent,
            "status": cmd.status,
            "timestamp": cmd.timestamp,
        }
        for cmd in commands
    ]
