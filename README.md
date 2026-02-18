# Aura — AI-Powered Teaching Assistant

> Co-authored by Ankit Kumar and Cursor

An AI-powered smartboard assistant that transcribes speech in real-time, captures whiteboard drawings, and enables voice-triggered AI commands (quiz generation, summaries, explanations) during live lectures.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, tldraw v2, Socket.IO, Zustand |
| Backend | FastAPI, SQLAlchemy, PostgreSQL, Socket.IO, Pydantic v2 |
| AI/ML | Google Gemini (LLM), EasyOCR (whiteboard text), Argon2 (auth) |
| Storage | Local filesystem (Images + Transcripts folders) |
| Infra | Docker, Docker Compose |

Redis has been intentionally removed — all processing is direct and in-memory, which is sufficient for 2-3 concurrent sessions.

---

## Architecture

```
Browser
  │
  ├── Web Speech API ──────────────────────────────────┐
  │     └── Live transcript shown in panel             │
  │     └── Final sentence → WebSocket → Backend       │
  │                                                     ▼
  ├── tldraw Whiteboard                        FastAPI + Socket.IO
  │     └── PNG snapshot every 30s → WebSocket      │
  │                                                  ├── handlers.py routes events
  └── Voice Command ("Hey Aura")                    │
        └── text → WebSocket → LLM Worker           ├── stt_worker.py
                                                    │     └── saves to Transcripts/
                                                    ├── vision_worker.py
                                                    │     └── EasyOCR → saves to Images/
                                                    └── llm_worker.py
                                                          └── Gemini → response → WebSocket → panel
```

### Data Flow

**Transcription:**
```
Speak → Chrome Web Speech API → isFinal result
  ├── Shown instantly in Live Transcript panel
  └── Sent to backend → appended to Transcripts/<session_id>/transcript.txt
```

**Whiteboard:**
```
Every 30 seconds → exportToBlob (tldraw PNG)
  → WebSocket → vision_worker
  → EasyOCR extracts text
  → Saved to Images/<session_id>/page_1_<timestamp>.png
  → Saved to DB (whiteboard_logs)
```

**Voice Commands:**
```
"Hey Aura, make a quiz" → WebSocket → llm_worker
  → Classify intent → Build context from DB
  → Gemini generates response
  → WebSocket → AI Panel on frontend
```

---

## Project Structure

```
Aura-New/
├── frontend/
│   └── src/
│       ├── app/                    # Pages: landing, auth, dashboard, classroom
│       ├── components/
│       │   ├── audio/AudioCapture.tsx      # Web Speech API, sends text to backend
│       │   ├── whiteboard/WhiteboardCanvas.tsx  # tldraw + 30s auto-screenshot
│       │   ├── transcript/LiveTranscript.tsx    # Toggleable transcript panel
│       │   └── ai-panel/AIPanel.tsx             # AI response display
│       ├── lib/websocket.ts        # Socket.IO client
│       ├── store/sessionStore.ts   # Zustand state
│       └── types/index.ts          # Shared TypeScript types
│
├── backend/
│   └── app/
│       ├── main.py                 # FastAPI app + Socket.IO mount
│       ├── core/
│       │   ├── config.py           # Settings (Pydantic BaseSettings)
│       │   ├── database.py         # SQLAlchemy setup
│       │   └── security.py         # JWT + Argon2 password hashing
│       ├── models/                 # SQLAlchemy models (8 tables)
│       ├── api/                    # REST endpoints: auth, sessions, quiz
│       ├── websocket/
│       │   ├── connection.py       # Socket.IO server, JWT auth on connect
│       │   └── handlers.py         # Event router: transcript_text, canvas_snapshot, voice_command
│       ├── workers/
│       │   ├── stt_worker.py       # Saves transcript text to file + DB
│       │   ├── vision_worker.py    # EasyOCR, saves PNG + DB
│       │   ├── llm_worker.py       # Gemini commands, direct WebSocket response
│       │   ├── compression_worker.py # Context compression (Gemini)
│       │   └── manager.py          # Worker lifecycle
│       └── services/
│           ├── storage_service.py  # Saves Images/ and auto-creates Transcripts/
│           ├── context_manager.py  # In-memory session buffer
│           └── ai_service.py       # Gemini API wrapper
│
├── docker-compose.yml              # postgres + backend + frontend
├── .env                            # Environment variables
└── D:/Aura-Storage/                # Host volume mounted at /storage in container
    ├── Images/                     # PNG screenshots per session
    └── Transcripts/                # transcript.txt per session
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Auth, profiles |
| `sessions` | Lecture sessions, compressed history |
| `transcripts` | Per-sentence speech log |
| `whiteboard_logs` | Canvas snapshots + OCR text |
| `commands` | Voice command execution log |
| `quizzes` | Generated quizzes |
| `quiz_attempts` | Student submissions |
| `fusion_events` | Speech ↔ visual correlation |

---

## Quick Start (Docker)

**Prerequisites:** Docker Desktop, Chrome browser, Gemini API key

**1. Create storage folders on your machine:**
```
D:/Aura-Storage/Images/
D:/Aura-Storage/Transcripts/
```

**2. Configure `.env`:**
```env
DATABASE_URL=postgresql://aura_user:aura_dev_password@localhost:5432/aura_db
JWT_SECRET=your-random-secret-key
GEMINI_API_KEY=your-gemini-key
LOCAL_STORAGE_PATH=/storage
ENVIRONMENT=development
```

**3. Start everything:**
```bash
docker-compose up -d
```

**4. Open:** http://localhost:3000

---

## Usage

1. Sign up / log in
2. Create a new session from the Dashboard
3. Click **Start** — microphone permission will be requested
4. Speak and draw on the whiteboard
5. Watch live transcript appear in the **Transcript** panel (bottom right)
6. Say **"Hey Aura, make a quiz"** / **"Hey Aura, summarize"** / **"Hey Aura, explain this"**
7. AI response appears in the right panel
8. Check storage after session:
   - `D:/Aura-Storage/Transcripts/<session_id>/transcript.txt`
   - `D:/Aura-Storage/Images/<session_id>/*.png`

---

## WebSocket Events

| Direction | Event | Payload |
|-----------|-------|---------|
| Client → Server | `transcript_text` | `{ sessionId, text, timestamp }` |
| Client → Server | `canvas_snapshot` | `{ sessionId, imageData (base64 PNG), pageNumber }` |
| Client → Server | `voice_command` | `{ sessionId, command }` |
| Server → Client | `transcript_update` | `{ id, text, timestamp, isFinal }` |
| Server → Client | `command_response` | `{ type, data, commandId, processingTime }` |
| Server → Client | `compression_started` | `{ message }` |
| Server → Client | `compression_complete` | `{ method, segmentNum }` |
| Server → Client | `error` | `{ message }` |

---

## API Endpoints

```
POST  /api/auth/signup
POST  /api/auth/login
GET   /api/auth/me

POST  /api/sessions
GET   /api/sessions
GET   /api/sessions/{id}
POST  /api/sessions/{id}/end
DELETE /api/sessions/{id}

GET   /api/quiz/{code}
POST  /api/quiz/{code}/submit
GET   /api/quiz/{code}/results
```

---

## Key Design Decisions

**No Redis** — Originally designed with Redis Streams for async processing. Removed because:
- Direct `asyncio.create_task()` calls are sufficient for 2-3 concurrent sessions
- Removes a dependency and operational complexity
- Simpler to reason about for a demo

**Browser STT over Whisper** — Web Speech API (Chrome's built-in) for live transcription instead of local Whisper because:
- No mic conflict with other audio capture
- Zero latency (results appear as you speak)
- Whisper doesn't support streaming (batch only)

**In-memory context buffer** — `context_manager.py` uses a Python dict instead of Redis lists. Resets on restart, fine for demo use.

---

## Troubleshooting

**Backend won't start:** Check `D:/Aura-Storage/` exists with `Images/` and `Transcripts/` subfolders.

**No transcript appearing:** Use Chrome or Edge (Web Speech API not in Firefox). Check microphone permissions.

**WebSocket won't connect:** Ensure backend container is healthy — `docker ps`. JWT token may have expired — log out and back in.

**Images not saving:** Check backend logs — `docker logs aura-new-backend-1`. Verify volume mount in docker-compose (`D:/Aura-Storage:/storage`).

**Check logs:**
```bash
docker logs aura-new-backend-1 --tail 50
docker logs aura-new-frontend-1 --tail 20
```
