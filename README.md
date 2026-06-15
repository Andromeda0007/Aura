# Aura — Real-Time Multi-Modal AI Teaching Assistant

Aura runs on the classroom smartboard: it **listens** to the teacher (speech→text),
**watches** the whiteboard (snapshot→OCR), fuses both into one live context, and on
**"Hey Aura, …"** instantly generates quizzes, summaries, explanations, examples,
diagrams, answers, or a cleaned board — grounded in what was just taught.

> Built fresh on the `sexy-aura` branch. Spec of record: [`AURA_BUILD.md`](./AURA_BUILD.md).

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind v4 · next-themes (light/dark) · tldraw v5 (pen/touch) · Zustand · Socket.IO client · recharts · Framer Motion |
| Backend | FastAPI · python-socketio · SQLAlchemy 2 · Alembic · Pydantic v2 · Argon2 · JWT (access + refresh) · structlog |
| AI (free) | **Groq** primary (`llama-3.1-8b-instant` classify, `llama-3.3-70b-versatile` generate) → **Gemini** fallback. Vision OCR: Groq/Gemini → EasyOCR. STT: browser Web Speech (default) → Whisper (lazy, optional). |
| Data | PostgreSQL (no Redis). Whiteboard images stored in Postgres (demo scale). |

## Features

Auth + sessions · live transcription with **"Hey Aura"** wake phrase · tldraw board with **pen/touch** + 10s auto-snapshot → OCR · **all 8 intents** (quiz, summarize, explain, example, diagram, answer, format_board, other) with themed result cards · **context compression** with a live token chip · **public student quiz page** (`/q/<code>` + QR) · TTS read-aloud · **Markdown + PDF export** · session history restore · **stats dashboard** (KPIs, activity, intent mix, latency) · full **light/dark** theming.

---

## Architecture

```
Browser (Next.js)                         FastAPI + Socket.IO (ASGI)
  Web Speech ─ transcript_text ─┐           ├─ STT worker      → transcripts
  "Hey Aura" ─ voice_command  ──┤  WSS      ├─ Vision worker   → OCR → whiteboard_logs
  tldraw 10s ─ canvas_snapshot ─┤ ───────►  ├─ LLM worker      → classify → fuse → Groq/Gemini → command_response
  REST (axios, JWT+refresh)  ───┘           └─ Compression worker (auto on token overflow)
                                            Services: Auth · Session · AIService · ContextManager
                                            Postgres (6 tables)   Free LLM APIs: Groq → Gemini
```

Command flow: `voice_command/typed → classify_intent (fast) → get_context (last ~30 transcripts + ~5 OCR + compressed history) → execute (smart) → persist Command (+Quiz w/ share code) → command_response`.

---

## Database (6 tables)

`users` · `sessions` (+ `compressed_history` JSONB) · `transcripts` · `whiteboard_logs` (image as base64) · `commands` · `quizzes` (share_code).
*(`fusion_events` from the spec is deferred — no current feature needs it.)*

---

## Run locally

**Prereqs:** Docker, Python 3.13, Node 20+, a free Groq key ([console.groq.com](https://console.groq.com)). Chrome/Edge for voice.

```bash
# 1. Postgres
docker compose up -d            # (or: docker run -d --name aura-db -e POSTGRES_USER=aura \
                                #   -e POSTGRES_PASSWORD=aura -e POSTGRES_DB=aura_db -p 5432:5432 postgres:16-alpine)

# 2. Backend
cd backend
python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env            # then paste GROQ_API_KEY into .env
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev                     # http://localhost:3000
```

Then: sign up → **Start** a session → allow mic → teach + draw → say **"Hey Aura, make a quiz"**.

## Tests

```bash
cd backend && .venv/bin/python -m pytest -q     # 18 tests (auth, parsing, context, API)
cd frontend && npm test                          # 7 tests (store, tts)
```

## API

```
GET  /health · /health/db
POST /auth/signup · /auth/login · /auth/refresh   GET /auth/me
POST /sessions   GET /sessions   GET /sessions/{id}   GET /sessions/{id}/history   POST /sessions/{id}/end
GET  /quizzes/{share_code}        # PUBLIC (no auth)
GET  /export/{session_id}         # Markdown
GET  /stats/overview · /stats/activity
WS   in:  transcript_text · audio_chunk · canvas_snapshot · voice_command · ping
WS   out: transcript_update · command_response · board_insight · compression_started/complete · context_update · error
```

## Deploy (Render — free)

`render.yaml` defines `aura-db` (Postgres), `aura-backend` (FastAPI), `aura-frontend` (Next.js). After the first deploy, set in the dashboard: `GROQ_API_KEY` (+ optional `GEMINI_API_KEY`) on the backend, `ALLOWED_ORIGINS` = frontend URL, and `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` = backend URL on the frontend. `JWT_SECRET` is auto-generated; `DATABASE_URL` is wired from `aura-db`.

## Security

Argon2 hashing · JWT (alg-allowlisted, access/refresh type-checked) · object-level session ownership on every route · WebSocket derives session from the authenticated socket (never the client payload) · ORM-only queries · Mermaid rendered `securityLevel: strict` · CORS allow-list · signup can't self-assign elevated roles · secrets via env only.
