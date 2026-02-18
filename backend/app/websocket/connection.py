import socketio
from typing import Dict, Set
import structlog
from urllib.parse import parse_qs

from ..core.config import get_settings
from ..core.security import decode_token

settings = get_settings()
logger = structlog.get_logger()

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=settings.ALLOWED_ORIGINS,
    logger=settings.DEBUG,
    engineio_logger=settings.DEBUG,
    max_http_buffer_size=10 * 1024 * 1024,  # 10MB — handles large canvas PNG + audio
)

sio_app = socketio.ASGIApp(sio)

active_connections: Dict[str, Set[str]] = {}


@sio.event
async def connect(sid: str, environ: dict, auth: dict):
    try:
        token = auth.get('token')
        query_string = environ.get('QUERY_STRING', '')
        params = parse_qs(query_string)
        session_id = params.get('session_id', [None])[0]
        
        if not token or not session_id:
            logger.warning("Connection rejected: missing credentials", sid=sid)
            return False
        
        # Validate JWT token
        try:
            payload = decode_token(token)
            user_id = payload.get('sub')
            if not user_id:
                logger.warning("Connection rejected: invalid token", sid=sid)
                return False
        except Exception as e:
            logger.warning("Connection rejected: token validation failed", sid=sid, error=str(e))
            return False
        
        logger.info("Client connected", sid=sid, session_id=session_id, user_id=user_id)
        
        if session_id not in active_connections:
            active_connections[session_id] = set()
        active_connections[session_id].add(sid)
        
        await sio.enter_room(sid, session_id)
        
        return True
    except Exception as e:
        logger.error("Connection error", sid=sid, error=str(e))
        return False


@sio.event
async def disconnect(sid: str):
    logger.info("Client disconnected", sid=sid)
    
    for session_id, sids in active_connections.items():
        if sid in sids:
            sids.remove(sid)
            if not sids:
                del active_connections[session_id]
            break


@sio.event
async def message(sid: str, data: dict):
    message_type = data.get('type')
    message_data = data.get('data')
    timestamp = data.get('timestamp')
    
    logger.debug("Message received", sid=sid, type=message_type)
    
    from . import handlers
    
    if message_type == 'audio_chunk':
        await handlers.handle_audio_chunk(sid, message_data)
    elif message_type == 'canvas_snapshot':
        await handlers.handle_canvas_snapshot(sid, message_data)
    elif message_type == 'voice_command':
        await handlers.handle_voice_command(sid, message_data)
    elif message_type == 'transcript_text':
        await handlers.handle_transcript_text(sid, message_data)
    elif message_type == 'ping':
        await sio.emit('message', {'type': 'pong', 'data': {}, 'timestamp': timestamp}, to=sid)
    else:
        logger.warning("Unknown message type", sid=sid, type=message_type)


async def broadcast_to_session(session_id: str, message_type: str, data: dict):
    message = {
        'type': message_type,
        'data': data,
        'timestamp': None,
    }
    await sio.emit('message', message, room=session_id)


async def send_to_client(sid: str, message_type: str, data: dict):
    message = {
        'type': message_type,
        'data': data,
        'timestamp': None,
    }
    await sio.emit('message', message, to=sid)
