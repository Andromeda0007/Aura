import asyncio
import structlog
from .connection import send_to_client, broadcast_to_session

logger = structlog.get_logger()


async def handle_audio_chunk(sid: str, data: dict):
    session_id = data.get('sessionId')
    audio_data = data.get('data')
    chunk_id = data.get('chunkId')
    timestamp = data.get('timestamp')

    if not session_id or not audio_data:
        logger.warning("Audio chunk missing data", sid=sid)
        return

    logger.info("Audio chunk received", session_id=session_id, chunk_id=chunk_id)

    from ..workers.stt_worker import STTWorker
    worker = STTWorker()
    asyncio.create_task(worker.process_audio({
        'session_id': session_id,
        'data': audio_data,
        'chunk_id': str(chunk_id),
        'timestamp': timestamp,
        'sid': sid,
    }))


async def handle_canvas_snapshot(sid: str, data: dict):
    session_id = data.get('sessionId')
    image_data = data.get('imageData')
    tldraw_state = data.get('tldrawState')
    page_number = data.get('pageNumber', 1)
    timestamp = data.get('timestamp')

    if not session_id or not image_data:
        logger.warning("Canvas snapshot missing data", sid=sid)
        return

    logger.info("Canvas snapshot received", session_id=session_id, page=page_number)

    from ..workers.vision_worker import VisionWorker
    worker = VisionWorker()
    asyncio.create_task(worker.process_image({
        'session_id': session_id,
        'image_data': image_data,
        'tldraw_state': str(tldraw_state) if tldraw_state else '',
        'page_number': str(page_number),
        'timestamp': timestamp,
    }))


async def handle_transcript_text(sid: str, data: dict):
    """Receives plain-English text from the browser's Web Speech API and saves it."""
    session_id = data.get('sessionId')
    text       = data.get('text', '').strip()
    timestamp  = data.get('timestamp')

    if not session_id or not text:
        return

    logger.info("Transcript text received", session_id=session_id, preview=text[:80])

    from ..workers.stt_worker import STTWorker
    worker = STTWorker()
    asyncio.create_task(worker.save_transcript_text({
        'session_id': session_id,
        'text': text,
        'timestamp': timestamp,
    }))


async def handle_voice_command(sid: str, data: dict):
    session_id = data.get('sessionId')
    command = data.get('command', '')
    timestamp = data.get('timestamp')
    confirmed_insights = data.get('confirmedInsights', [])
    image_data = data.get('imageData')  # present when caller needs immediate vision analysis

    if not session_id or not command:
        return

    logger.info("Voice command received", session_id=session_id, command=command[:60])

    if "hey aura" not in command.lower():
        return

    await send_to_client(sid, 'command_processing', {'message': 'Processing your command...'})

    # If image data was included, run vision synchronously BEFORE the LLM so the
    # context query finds up-to-date whiteboard content in the DB.
    if image_data:
        try:
            from ..workers.vision_worker import VisionWorker
            await VisionWorker().process_image({
                'session_id': session_id,
                'image_data': image_data,
                'tldraw_state': '',
                'page_number': '1',
                'timestamp': timestamp,
            })
        except Exception as exc:
            logger.warning("Inline vision processing failed", error=str(exc))

    from ..workers.llm_worker import LLMWorker
    asyncio.create_task(LLMWorker().process_command({
        'session_id': session_id,
        'command': command,
        'timestamp': timestamp,
        'sid': sid,
        'confirmed_insights': confirmed_insights,
    }))
