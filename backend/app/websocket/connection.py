"""Socket.IO realtime server: JWT + session_id auth, rooms, ping/pong, helpers.

Data-event handlers (audio_chunk, canvas_snapshot, voice_command, transcript_text)
are registered in later phases; this module owns connection lifecycle + helpers.
"""
from __future__ import annotations

import uuid
from urllib.parse import parse_qs

import socketio

from app.core.config import settings
from app.core.database import session_scope
from app.core.logging import get_logger
from app.core.security import decode_token
from app.models.session import Session

logger = get_logger("aura.ws")

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.allowed_origins_list,
    max_http_buffer_size=10_000_000,  # 10 MB — large canvas PNG / audio chunks
    logger=settings.debug,
    engineio_logger=False,
)

# sid -> {"user_id": str, "session_id": str}
active_connections: dict[str, dict[str, str]] = {}


def _extract_session_id(environ: dict) -> str | None:
    qs = parse_qs(environ.get("QUERY_STRING", ""))
    vals = qs.get("session_id")
    return vals[0] if vals else None


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None) -> bool:
    """Authenticate (JWT access token + owned session_id) then join the session room."""
    token = (auth or {}).get("token")
    session_id = _extract_session_id(environ)
    if not token or not session_id:
        logger.warning("ws.connect.missing_credentials", sid=sid)
        return False

    payload = decode_token(token, expected_type="access")
    if payload is None:
        logger.warning("ws.connect.bad_token", sid=sid)
        return False

    try:
        user_id = uuid.UUID(payload["sub"])
        sess_uuid = uuid.UUID(session_id)
    except (KeyError, ValueError):
        logger.warning("ws.connect.bad_ids", sid=sid)
        return False

    # Verify the session exists and belongs to this user.
    with session_scope() as db:
        sess = db.get(Session, sess_uuid)
        if sess is None or sess.teacher_id != user_id:
            logger.warning("ws.connect.session_denied", sid=sid, session_id=session_id)
            return False

    await sio.enter_room(sid, session_id)
    active_connections[sid] = {"user_id": str(user_id), "session_id": session_id}
    logger.info("ws.connect", sid=sid, session_id=session_id, user_id=str(user_id))
    await sio.emit("connected", {"sessionId": session_id}, to=sid)
    return True


@sio.event
async def disconnect(sid: str) -> None:
    info = active_connections.pop(sid, None)
    if info:
        await sio.leave_room(sid, info["session_id"])
    logger.info("ws.disconnect", sid=sid)


@sio.event
async def ping(sid: str, data: dict | None = None) -> None:
    await sio.emit("pong", {"ts": (data or {}).get("ts")}, to=sid)


# ---- broadcast helpers used by workers in later phases ----
async def broadcast_to_session(session_id: str, event: str, data: dict) -> None:
    """Emit an event to everyone in a session room."""
    await sio.emit(event, data, room=session_id)


async def send_to_client(sid: str, event: str, data: dict) -> None:
    """Emit an event to a single connected socket."""
    await sio.emit(event, data, to=sid)
