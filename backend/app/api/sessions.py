from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator, Field, ConfigDict
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_teacher
from ..models import User, Session as SessionModel, SessionStatus, Command, CommandIntent, Transcript

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
    
    commands = db.query(Command).filter(Command.session_id == session_id).order_by(Command.timestamp.asc()).all()
    intent_to_type = {
        CommandIntent.GENERATE_QUIZ: "quiz",
        CommandIntent.SUMMARIZE: "summary",
        CommandIntent.EXPLAIN: "explanation",
        CommandIntent.GENERATE_EXAMPLE: "example",
        CommandIntent.GENERATE_DIAGRAM: "diagram",
        CommandIntent.ANSWER_QUESTION: "answer",
        CommandIntent.OTHER: "answer",
    }
    return [
        {
            "id": str(cmd.id),
            "raw_command": cmd.raw_command,
            "intent": cmd.intent.value if hasattr(cmd.intent, "value") else str(cmd.intent),
            "type": intent_to_type.get(cmd.intent, "answer"),
            "status": cmd.status.value if hasattr(cmd.status, "value") else str(cmd.status),
            "timestamp": cmd.timestamp.isoformat() if cmd.timestamp else None,
            "llm_response": cmd.llm_response,
            "processing_time_ms": cmd.processing_time_ms,
        }
        for cmd in commands
    ]


class ValidateAnswerRequest(BaseModel):
    problem: str
    correct_answer: str
    user_answer: str


@router.post("/{session_id}/validate-answer")
async def validate_answer(
    session_id: str,
    request: ValidateAnswerRequest,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db),
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

    from ..services.ai_service import AIService
    ai = AIService()
    result = await ai.validate_answer(
        problem=request.problem,
        correct_answer=request.correct_answer,
        user_answer=request.user_answer,
    )
    return result


# ── Clean Board ───────────────────────────────────────────────────────────────

class CleanBoardRequest(BaseModel):
    imageData: str  # base64 PNG from the canvas


@router.post("/{session_id}/clean-board")
async def clean_board(
    session_id: str,
    request: CleanBoardRequest,
    current_user: User = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Send board screenshot to Gemini Vision; return clean text blocks."""
    import base64, requests as req
    from ..core.config import get_settings

    cfg = get_settings()
    if not cfg.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    # Strip data-URL header if present
    raw_b64 = request.imageData.split(",", 1)[1] if "," in request.imageData else request.imageData

    try:
        base64.b64decode(raw_b64)  # validate
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    prompt = (
        "You are reading a classroom whiteboard screenshot. "
        "Identify ONLY text written in handwriting or free-form pen/pencil strokes. "
        "Rules: "
        "1. Ignore text inside neat rectangular boxes or formatted blocks — those are already structured. "
        "2. Ignore diagrams, arrows, shapes, drawings, or any non-text content — skip them entirely. "
        "3. For each handwritten word or short phrase, clean up spelling and capitalization. "
        "4. Return ONLY valid JSON, no markdown, no explanation:\n"
        '{"blocks": ["CleanWord1", "Clean Phrase 2"]}\n'
        'If no handwriting found, return {"blocks": []}.'
    )

    import asyncio, json

    loop = asyncio.get_event_loop()

    def _call_groq() -> str:
        from groq import Groq
        client = Groq(api_key=cfg.GROQ_API_KEY)
        resp = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url",
                     "image_url": {"url": f"data:image/png;base64,{raw_b64}"}},
                    {"type": "text", "text": prompt},
                ],
            }],
            max_tokens=256,
            temperature=0,
        )
        return resp.choices[0].message.content.strip()

    def _call_gemini() -> str:
        url = (
            "https://generativelanguage.googleapis.com/v1beta"
            f"/models/gemini-2.0-flash-lite:generateContent?key={cfg.GEMINI_API_KEY}"
        )
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/png", "data": raw_b64}},
                ]
            }],
            "generationConfig": {"maxOutputTokens": 256},
        }
        r = req.post(url, json=payload, timeout=30)
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()

    def _parse(text: str) -> list:
        if "```" in text:
            text = text.split("```")[1].split("```")[0]
            if text.lstrip().startswith("json"):
                text = text.lstrip()[4:]
        return [b.strip() for b in json.loads(text.strip()).get("blocks", [])
                if isinstance(b, str) and b.strip()]

    # Try Groq Vision first (better rate limits), fall back to Gemini
    last_err = None
    for fn in ([_call_groq] if cfg.GROQ_API_KEY else []) + ([_call_gemini] if cfg.GEMINI_API_KEY else []):
        try:
            text = await loop.run_in_executor(None, fn)
            return {"blocks": _parse(text)}
        except Exception as e:
            last_err = e
            continue

    raise HTTPException(status_code=502, detail=f"Vision API failed: {last_err}")
