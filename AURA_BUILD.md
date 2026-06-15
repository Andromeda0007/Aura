# AURA — Build Specification

> **Real-Time Multi-Modal AI Teaching Assistant**
> A professional, build-from-scratch specification. Hand this entire file to a fresh Claude Code session.
> This document defines **WHAT to build and the quality bar** — not line-by-line code.

---

## 0. How to use this document (building agent, read first)

You are (re)building **Aura** from zero. This file is the contract for **what** must exist and **how good** it must be. The **overall design, flow, numbers, and architecture are governed by the project's two source documents** — treat them as the master plan:
- **`research-paper.tex`** — the IEEE paper (authoritative for the system model, metrics, and intent design).
- **`BE_Project_Final_Report.tex`** — the full project report (authoritative for chapter-level architecture, diagrams, SRS, and design).

Use those two documents for **what the product is and the overall design intent** — the concept, the flow, the metrics, the feature set. They are the *plan*, not a code template.

**Build the best possible version of this product.** A previous prototype of Aura exists in this repo, but it was rough, visually poor, and not fully working — **do NOT treat it as a reference to replicate, and do NOT copy it.** You are free to choose the cleanest modern implementation, the nicest UI, and better approaches for every feature (the quiz, the questions, the board, everything). This file lists *what* must exist and the *quality bar*; how you achieve it well is yours to decide.

**Working rules (owner is a DevOps engineer — honor these):**
1. **Plan → cross-question → confirm → then code.** Don't write code until told. Challenge anything risky.
2. **Local-first.** Must run + be testable locally with good logs before any productionizing.
3. **Feature branches only** — never commit to `main`. Ask for the branch name first.
4. **Never run mutating prod/infra commands** — print what *would* happen and wait for manual verification.
5. **Secrets in `.env` only** — never hardcode or log secret values.
6. **Incremental** — small reviewable changes; pause for review after each.

**One-sentence definition:** a web app where a teacher runs a live class on a smartboard; Aura listens (speech→text via **Whisper**), watches the whiteboard (snapshot→**OCR**), fuses both streams, and on **"Hey Aura, …"** instantly generates quizzes, summaries, explanations, examples, diagrams, answers, or a cleaned board — grounded in exactly what was just taught.

**The app's runtime AI uses FREE external APIs (NOT Claude):** Groq (free tier) primary, Google Gemini (free tier) fallback.

---

## 1. Product vision & audience
- **Audience:** school/university teachers running live in-person or online lessons.
- **Primary device = the interactive smartboard** (large touchscreen + stylus/pen), with laptop/desktop as a secondary device. The board is the main surface a teacher stands at and writes on with the smartboard pen; the UI must be designed touch-and-pen-first, not mouse-and-keyboard-first. (See §12.1.)
- **Problem:** teachers spend hours after class making quizzes/summaries/notes that drift from what was actually said and drawn.
- **Solution:** capture the lecture in real time (voice + whiteboard), fuse both into one evolving context, and generate pedagogically-grounded content on demand — during or right after class.
- **North-star:** say *"Hey Aura, make a quiz on this"* → ~2s later a clean 5-question MCQ appears, shareable to students via QR, built from the exact board + speech context.
- **Non-goals (v1):** student learning app, full LMS/grading, native mobile, multi-teacher co-editing of one board.

---

## 2. The system at a glance
Four always-on capabilities, one command surface:
1. **Listen** — live speech → text (Whisper target; browser Web Speech today/fallback).
2. **See** — whiteboard PNG snapshot every **10s** → OCR → board text.
3. **Fuse** — time-ordered merge of speech + board + compressed history into one context.
4. **Act** — on a wake-phrase command, classify intent → generate grounded content → stream back.

---

## 3. End-to-end teacher flow
```
SIGN UP / LOG IN → JWT issued (Argon2 hashing).
START SESSION    → name subject → Session(status=ACTIVE) → open workspace → connect WebSocket (JWT + session_id).
TEACH (always-on):
   Voice → audio captured → Whisper transcription → persisted → live transcript panel.
   Board → tldraw canvas → PNG snapshot every 10s (+ on demand) → OCR → stored board text + insight.
COMMAND ("Hey Aura, ...") → wake phrase detected (or typed) → classify intent → fuse context → run intent → stream result.
CONSUME → AI panel renders by type (quiz/summary/explanation/example/diagram/answer/formatted board);
          edit · read aloud (TTS) · share quiz (QR + code) · paste to board · export.
CONTEXT → background compression keeps it fast; a token chip shows "context ~N tokens • compressing…".
END SESSION → status=COMPLETED, end_time set; everything persisted + restorable; exportable.
```

---

## 4. Complete feature set (build all of these, and build them *well*)

### The 8 canonical intents (use this exact set everywhere)
| Intent | Output | Notes |
|---|---|---|
| `generate_quiz` | exactly **5** MCQs | gets share code + QR; grounded in lecture |
| `summarize` | 200–500 word structured summary | |
| `explain` | clear concept explanation | offers "next topics" chips |
| `generate_example` | worked / numerical example | interactive student answer validation |
| `generate_diagram` | Mermaid diagram | chemistry → optional **PubChem** lookup |
| `answer_question` | answer + feedback | lenient on units/format |
| `format_board` | clean structured text blocks from messy board OCR | **first-class intent** (see §23) |
| `other` | safe catch-all | prevents bad downstream calls |

### Extended classroom features
- **Quiz sharing:** unique `share_code` + QR; public student page (no login) to take the quiz.
- **Answer validation:** correctness + feedback, lenient on units (`/sessions/{id}/validate-answer`).
- **Board insights:** every snapshot, a vision model describes new board content; teacher confirms; confirmed insights ride along with the next command.
- **Auto-summarize:** optional periodic summary at topic/word-count boundaries (with cooldown).
- **TTS readback:** read any AI response aloud (browser SpeechSynthesis).
- **Clean board / format board:** rewrite the board into tidy blocks; paste back to canvas.
- **Session export:** download the full session (transcript + AI outputs) as Markdown/PDF.
- **Context compression + token display** (see §14).
- **History restore:** reopening a session reloads transcripts + AI history.
- **Stats / analytics dashboard:** a dedicated, chart-rich insights page for the teacher (see §15.2).

---

## 5. System architecture
```
CLIENT (Next.js, browser)
  Live workspace: transcript panel | tldraw board | AI panel | footer command box
  Whisper-fed audio capture · SpeechSynthesis (TTS) · Socket.IO client · Zustand · axios (REST)
        │ REST (HTTPS)                         Socket.IO (WSS)
        ▼                                            ▼
BACKEND (FastAPI + python-socketio, ASGI)
  REST: /auth /sessions /quizzes /export
  WS in:  audio_chunk · canvas_snapshot · voice_command · transcript_text · ping
  WS out: command_response · transcript_update · board_insight · compression_started/complete · error
  Async workers (non-blocking, asyncio): LLM · STT(Whisper) · Vision(OCR) · Compression
  Services: AuthService · SessionService · AIService · ContextManager
        │                    │                         │
        ▼                    ▼                         ▼
  PostgreSQL (7 tables)   OCR: Gemini Vision        FREE LLM APIs
   (single store)         → EasyOCR fallback        Primary: Groq (llama-3.1-8b-instant / 3.3-70b-versatile)
                          STT: Whisper              Fallback: Google Gemini (gemini-2.0-flash / -lite)
```
**Principle:** realtime capture over WebSocket; all heavy work offloaded to non-blocking workers; LLM/Vision providers behind interfaces so a free API can be swapped via config.

---

## 6. Tech stack (recommended — pick the best tools; this is guidance, not a cage)
> These are sensible, modern, free-friendly choices that fit the product. They are recommendations to build the *best* version — not a requirement to mirror the old prototype. Swap any tool for a clearly better one and note why.

**Frontend** — Next.js (App Router) + React + **TypeScript (strict)**; Tailwind CSS; Zustand (state); Framer Motion (animation); **tldraw** (whiteboard); Socket.IO client; axios; Mermaid.js (diagrams); qrcode.react (quiz QR); lucide-react (icons). Web Speech (capture) + SpeechSynthesis (TTS). (Full polish toolkit in §25.)

**Backend** — FastAPI (Python 3.11) + Uvicorn (ASGI); python-socketio (AsyncServer); SQLAlchemy 2.0 + Alembic; Pydantic v2; Argon2 (passwords); python-jose / JWT; structlog; Pillow/opencv/numpy (image); EasyOCR; **faster-whisper / openai-whisper** (server STT).

**Data/infra** — **PostgreSQL** (single primary store; **no Redis**). In-process caching + a single-worker Socket.IO server keep it simple for v1.

**AI (FREE external APIs — not Claude):**
- **Primary: Groq** — `llama-3.1-8b-instant` (fast: classification, validation, compression), `llama-3.3-70b-versatile` (smart: generation).
- **Fallback: Google Gemini** — `gemini-2.0-flash` / `gemini-2.0-flash-lite`. Auto-engages on Groq failure/rate-limit.
- Free-tier rate limits are real → **retry + Groq→Gemini fallback is mandatory.**

---

## 7. External APIs (all free tiers)
| Need | Service | Model / note |
|---|---|---|
| Intent classification | Groq | `llama-3.1-8b-instant` |
| Content generation | Groq | `llama-3.3-70b-versatile` |
| LLM fallback | Google Gemini | `gemini-2.0-flash` / `-lite` |
| OCR (primary) | Gemini Vision (REST) | `gemini-2.0-flash-lite:generateContent` |
| OCR (fallback) | EasyOCR | local, no key |
| STT | **Whisper** | server-side (faster-whisper); browser Web Speech as fallback |
| TTS | SpeechSynthesis | browser-native |
| Chemistry | PubChem PUG REST | for molecular `generate_diagram`, no key |

---

## 8. Data model (PostgreSQL — 7 tables)
```
users           id(uuid pk) · email(unique) · password_hash(argon2) · full_name · role(teacher|student|admin)
                · is_active · created_at · updated_at · last_login
sessions        id · teacher_id(fk users) · subject · status(active|paused|completed)
                · compressed_history(jsonb) · active_buffer_tokens · session_metadata(jsonb) · start_time · end_time
transcripts     id · session_id(fk) · text · timestamp · confidence · is_processed
whiteboard_logs id · session_id(fk) · tldraw_snapshot(jsonb) · image_data(BYTEA/base64 — stored in Postgres) · ocr_text · timestamp · page_number
commands        id · session_id(fk) · raw_command · intent(enum) · llm_response(jsonb) · status · processing_time_ms · error_message · timestamp
quizzes         id · session_id(fk) · command_id · share_code(unique) · quiz_data(jsonb) · created_at · expires_at
fusion_events   id · session_id(fk) · transcript_id(fk) · whiteboard_id(fk) · relationship_type · confidence · timestamp
```
FKs enforced; cascade-delete from session. `compressed_history` is a JSONB list of structured summaries. Whiteboard images live in Postgres (`image_data`) at demo scale — no object storage (§13).

---

## 9. Backend contract

### REST
```
POST /auth/signup {email,password,full_name,role}  → 201 {user, token}
POST /auth/login  {email,password}                 → 200 {token} | 401
GET  /auth/me     (Bearer)                          → 200 {user}
POST /sessions {subject}                            → 201 {session}
GET  /sessions/:id                                  → 200 {session, transcripts, commands}
POST /sessions/:id/end                              → 200 {session COMPLETED}
GET  /sessions                                      → 200 [session...]
POST /sessions/:id/validate-answer {problem,correct_answer,user_answer} → {isCorrect, feedback}
POST /sessions/:id/clean-board {imageData}          → {blocks:[...]}
GET  /quizzes/:share_code                           → 200 {quiz_data}   (PUBLIC, no auth)
GET  /export/:session_id (Bearer)                   → file
```

### WebSocket (Socket.IO) — auth on connect: JWT in handshake `auth.token` + `?session_id=`; join room = session_id; reject invalid.
**Incoming:** `canvas_snapshot` {imageData, tldrawState, pageNumber} · `transcript_text` {text} · `voice_command` {command, confirmedInsights, imageData} · `audio_chunk` {data} · `ping`.
**Outgoing:** `command_processing` · `command_response` {type,data,commandId,processingTime} · `board_insight` {description} · `compression_started` · `compression_complete` · `error`.
Helpers: `broadcast_to_session(room)`, `send_to_client(sid)`.

### Async workers (all non-blocking)
- **LLM Worker** — classify intent → create `commands` row (PROCESSING) → `_get_context` (fuse) → execute intent → persist response (COMPLETED + processing_time_ms) → `command_response`.
- **STT Worker (Whisper)** — see §11.
- **Vision Worker (OCR)** — see §13.
- **Compression Worker** — see §14.

---

## 10. AI layer
- **Two-stage:** classify with the **fast** model (8 intents; coerce unknown→`other`); generate with the **smart** model; **enforce strict JSON**, strip markdown fences, parse with error handling; **repair-or-retry once**, else safe `error`.
- **Fallback:** on Groq failure/limit → retry on Gemini with the same prompt contract.
- **Context fusion (`_get_context`):** last ~30 transcripts + last ~5 OCR texts + `compressed_history` summaries, time-ordered.
- **Per-intent JSON contracts:** quiz `{questions:[{q,options[4],answer_index,explanation}×5]}` · summarize `{summary}` · explain `{explanation,nextTopics[]}` · example `{problem,solution,correct_answer}` · diagram `{mermaid}` · answer `{answer,isCorrect,feedback}` · format_board `{blocks[]}` · other `{message}`.

---

## 11. Speech-to-Text — how we use Whisper
- **Target architecture (build this):** the browser captures microphone audio and streams **base64 audio chunks** over the `audio_chunk` WebSocket event. The **STT Worker** decodes the WAV payload, runs **Whisper** inference (server-side `faster-whisper`, CPU-friendly), **filters noise/hallucinations** (drop empty/low-confidence/known filler outputs), persists a `transcripts` row, and emits `transcript_update` to the live panel.
- **Why Whisper:** robust multilingual accuracy in noisy classrooms, runs locally/privately (no per-call cost), aligns with the research paper's STT model.
- **Fallback / current path:** browser **Web Speech API** (`webkitSpeechRecognition`) sends finalized text via `transcript_text` (saved directly, confidence ≈ 0.9). Keep this as the no-GPU fallback and for browsers where it works (Chrome/Edge). State clearly in the UI when only typed input is available (Firefox/Safari).
- **Wake phrase:** finalized segments are normalized and scanned for **"hey aura"**; the remainder becomes the command and is sent as `voice_command`. The typed command box auto-prepends "hey aura" if missing.

---

## 12. Whiteboard + snapshot pipeline
- **Canvas:** tldraw — theme follows the app (light/dark, §15.1), grid, tall vertical page; imperative API for `addBlock`, `replaceWithBlocks`, `mergeBlockWithAnswer`, `addImageToBoard`, `addTextToBoard`.
- **Snapshot:** while recording, export a **PNG every 10 seconds** (and on demand before a command) via `exportToBlob` → base64 → `canvas_snapshot`.
- **Local autosave:** persist editor state to localStorage (throttled ~3s) keyed by session.
- **Paste-to-board:** AI outputs (clean blocks, Mermaid SVG/PNG, Q+A merges) can be pasted back onto the canvas.

### 12.1 Smartboard & touch/stylus support (first-class requirement)
The app must run on an **interactive smartboard** (large touchscreen with a pen/stylus), not just a laptop:
- **Input:** use the **Pointer Events API** so tldraw treats **stylus/pen, touch, and mouse** uniformly. Support **pen pressure** (`pointerType === 'pen'`, `pressure`) for natural ink, and distinguish pen (draw) from finger (pan/select) where the hardware reports `pointerType`.
- **Palm rejection:** ignore large-contact / non-pen touches while a pen is active so a resting hand doesn't draw.
- **Multi-touch gestures:** pinch-to-zoom and two-finger pan; single-pen draw.
- **Big touch targets:** all controls ≥ ~44–48px, generously spaced; no hover-only or right-click-only actions; no tiny drag handles — everything reachable by tapping with a pen at arm's length.
- **Large-display scaling:** lay out cleanly on 55–86" boards at 1080p/4K — readable type, scalable toolbar, no cramped corners.
- **Voice-first, typing-optional:** typing on a board is awkward, so **"Hey Aura" voice is the primary command path**; the typed box must summon the on-screen keyboard gracefully but is the fallback.
- **Mic + visibility:** use the board's built-in/connected microphone; make the listening state obvious from across the room (large pulsing indicator).
- **Fullscreen / kiosk:** support a fullscreen "teach" mode (Fullscreen API) suited to board use.
- **Platform note:** smartboards typically run **Chrome/Edge on Windows or Android** — fine for both the Whisper audio path and the Web Speech fallback. Test on the actual target board's browser.

---

## 13. OCR / Vision
- **Primary:** **Gemini Vision** (REST `generateContent`) — reads the snapshot, returns board text; run in an executor so it never blocks the loop.
- **Fallback:** **EasyOCR** (CPU, English, lazy-loaded) when no Gemini key.
- **Clean-board path:** try Groq Vision (`llama-4-scout`) then Gemini → `{blocks:[...]}`.
- **Board insight:** if new OCR text differs >~30 chars from the last, emit `board_insight` so the teacher can confirm it into context.
- **Image storage = Postgres** (demo scale, < ~1000 snapshots total): store each capture as a `whiteboard_logs` row holding the **PNG bytes in `image_data` (BYTEA/base64)** + `tldraw_snapshot` + `ocr_text` + `page_number`. No object storage / no external bucket. (If this ever needs to scale, swap `image_data` for an object-store URL behind a storage interface — not needed for v1.)

---

## 14. Context compression + token display (headline UX)
- **ContextManager** keeps an in-memory per-session buffer with a running **token estimate** (`chars/4`), limit from `COMPRESSION_TOKEN_LIMIT` (default 10,000).
- **Auto-trigger (build this):** when the buffer crosses the limit, the **Compression Worker** runs automatically (the original had no auto-trigger — fix that).
- It summarizes the buffer (fast model; fallback to a simple extractive summary) into a structured object **`{topicFlow, keyConcepts, visualReferences, dependencies}`**, appends `{segment_num, time_range, token_count, compression_method, summary}` to `sessions.compressed_history`, and clears the buffer.
- **UI:** a small chip shows **"context · ~N tokens"** → **"compressing…"** → **"compressed ✓"** (driven by `compression_started/complete`). Make this visible and satisfying — it's a deliberate showcase.

---

## 15. Frontend design (the "nice & sexy board")
**Live workspace layout**
```
┌ Top bar: Aura · subject · ●REC timer · context-token chip · ☀/🌙 theme · end ┐
├───────────────┬───────────────────────────────┬───────────────┤
│ TRANSCRIPT    │           THE BOARD            │  AI PANEL     │
│ live, auto-   │  tldraw, full-bleed, rounded,  │  tabs: Latest │
│ scroll, speaker│ soft shadow, glass toolbar,   │  / History;   │
│ bubbles       │  "✨ Capture", paste targets   │  render by    │
│               │                                │  type         │
├───────────────┴───────────────────────────────┴───────────────┤
│ Footer: ⌨ type a command…  · 🎤 "Hey Aura" listening · 🔊 TTS  │
└─────────────────────────────────────────────────────────────────┘
```
**Design language:** rounded-2xl, soft shadows, subtle glassmorphism; an accent gradient for primary actions and the listening pulse; Framer Motion for AI-result reveals, the mic pulse, and quiz-card flips. The tldraw board is the hero (minimal chrome, floating glass toolbar). Quiz = clean card stack with big QR + share code; diagram = framed Mermaid render. Responsive from smartboard (large touch display) down to tablet; **voice-first, touch/pen-friendly** command surface (typed box is the fallback). (shadcn/ui recommended for consistent, accessible primitives.) The old prototype's look was poor — aim for genuinely polished, modern, classroom-grade UI.

**Polish with the design skills (see §24):** use **impeccable** for layout/visual quality (`/audit`, `/critique`, `/polish`) and **emilkowalski/skill** for motion/micro-interactions. Heavy use on the board, AI panel, quiz cards, and transitions.

**State (Zustand):** `authStore` (user, tokens, isAuthenticated, **theme** — persisted) and `sessionStore` (currentSession, transcriptEntries, commands, latestAIResponse, aiHistory, compressionStatus, pendingInsight, confirmedInsights, isRecording).

**Result components:** QuizDisplay (lock-on-answer + score), SummaryDisplay, ExplanationDisplay (clickable next-topics), DiagramDisplay (Mermaid + chemistry, add/replace board), ExampleDisplay (interactive validation).

### 15.1 Theming — light & dark, classroom-aware (REQUIRED)
Ship **both light and dark themes, fully** — every surface themed (board, panels, AI cards, quiz, modals, toasts, transcript). Built once via design tokens (semantic CSS variables / Tailwind `dark:`), through a theme provider (**next-themes**).
- **Classroom-scenario aware** (lighting in a classroom changes during a lesson):
  - **Light theme** — default for a bright, lights-on room and for content meant to be **read from the back of the room**: max contrast, dark ink on a white board, large type. Feels like a real whiteboard.
  - **Dark theme** — for **dimmed rooms** (when projecting video/slides) and to cut glare on a large emissive panel; ink flips to light-on-dark.
- **Controls:** an always-visible **one-tap theme toggle in the top bar** (lighting shifts mid-class, so it must be instant), **and** respect the OS `prefers-color-scheme` on first load, **and remember** the choice (persisted in `authStore`/localStorage). May *suggest* a switch by time-of-day, but never auto-flip without an obvious manual override.
- **The tldraw board theme follows the app theme**, and **ink colors must stay legible in both modes** — auto-map default pen colors so dark-on-light becomes light-on-dark appropriately; never produce invisible ink. Exported snapshots/OCR are unaffected by theme.
- **Contrast bar:** **WCAG AA** minimum (AAA for large headings) in *both* themes; validate at projector/board brightness and from a distance. No low-contrast pastel text on a big screen.
- Record the active theme in the impeccable design context (`.impeccable.md`) so generated UI respects both modes.

### 15.2 Stats / Analytics dashboard (`/dashboard` or `/stats`) — make it a showcase
A beautiful, chart-rich insights page so a teacher can *see* their teaching. Themed (light/dark), responsive, animated reveals, polished with **impeccable** + **emilkowalski**.

**Top KPI cards (animated count-up):** total sessions · total teaching time · words transcribed · commands issued · quizzes generated · students reached (quiz takers) · avg session length · avg AI latency.

**Charts & sections:**
- **Activity over time** — area/line chart of sessions & teaching minutes per day/week (range picker).
- **Calendar heatmap** — a GitHub-style contribution heatmap of teaching activity by day (great visual).
- **Commands by intent** — donut + bar: quiz vs summarize vs explain vs example vs diagram vs answer vs format_board (which features the teacher actually uses).
- **AI performance** — latency distribution with **P50/P95** markers per intent; tokens used over time; count of **context-compression** events (ties to the token chip).
- **Quiz analytics** — avg score across shared quizzes, score distribution, and **most-missed questions** (hardest items) so the teacher sees where students struggle; quiz-share open/attempt funnel.
- **Topic coverage** — a **word cloud / frequency bars** built from `topicFlow` + `keyConcepts` in `compressed_history` (what was actually taught).
- **Subject breakdown** — sessions/time per subject (stacked bar).
- **Whiteboard activity** — snapshots & OCR volume over a session/timeline.
- **Per-session drill-down** — click a session → mini timeline of transcripts, board captures, and which intents fired when.

**Data source:** aggregate from the existing tables (`sessions`, `transcripts`, `commands`, `quizzes`, `whiteboard_logs`, `fusion_events`) via dedicated read-only `/stats` endpoints (server-side aggregation; cache lightly). Empty states use a friendly **Lottie/unDraw** illustration.

**Charting libs:** **Tremor** (KPI cards + charts, Tailwind-native, dashboard-grade — primary) on **Recharts**; **Nivo** for the fancy ones (calendar heatmap, word cloud, richer distributions). All free/open-source and theme-aware.

---

## 16. Security best practices (mandatory bar)
- **Auth:** Argon2 password hashing; JWT (HS256) bearer for REST; JWT + session_id for socket handshake (reject invalid). **Add refresh tokens** + short-lived access tokens (original used only an 8h access token — improve this). Keep `JWT_SECRET` in env.
- **Authorization:** role-based (teacher-only session CRUD); object-level checks (a teacher only touches their own sessions); the **only** unauthenticated route is the public quiz-by-share-code (exposes just `quiz_data`).
- **Transport:** HTTPS/WSS everywhere in prod; HSTS; secure cookies if used.
- **Input validation:** Pydantic v2 on every request/response; reject oversized payloads; cap WebSocket buffer (≈10 MB) and validate base64 image/audio sizes.
- **Injection/XSS/CSRF:** ORM-parameterized queries only (no string SQL); sanitize/escape any rendered AI/user HTML; SameSite cookies / token-based requests to avoid CSRF; never `dangerouslySetInnerHTML` untrusted content; render Mermaid/SVG safely.
- **CORS:** strict allow-list from `ALLOWED_ORIGINS`.
- **Rate limiting & abuse:** per-IP/user limits on auth + command endpoints; backoff on the free-tier LLM calls; quiz share codes are unguessable + optional `expires_at`.
- **Secrets:** `.env` only, never logged, never committed; provide `.env.example`. No secrets in client bundles (only `NEXT_PUBLIC_*` are public).
- **Data:** least-privilege DB user; encrypt at rest where the platform supports it; allow session deletion (privacy); don't log transcript/PII bodies at INFO.
- **Dependencies:** pin versions; run `pip-audit` / `npm audit`; keep lockfiles.

---

## 17. General web best practices
- **Performance:** async non-blocking workers; GZip; DB connection pooling (pool 10 / overflow 20, pre-ping); lightweight in-process caching; lazy-load heavy ML (EasyOCR/Whisper); code-split the frontend; optimize images; debounce/throttle snapshots + autosave.
- **Reliability:** retries + provider fallback (Groq→Gemini); graceful degradation (typed commands when speech unavailable; EasyOCR when no vision key); WebSocket auto-reconnect with backoff; idempotent handlers; health-check endpoint.
- **Observability:** structured logging (structlog, key-value, no secrets); request IDs; processing-time metrics on commands; error tracking.
- **Accessibility:** semantic HTML, ARIA on controls, keyboard navigation, visible focus, sufficient contrast in **both** themes, captions/transcript as an a11y win.
- **SEO/meta (public pages):** proper `<title>`/meta/OpenGraph on landing + public quiz pages; sensible favicons/manifest.
- **Quality:** TypeScript strict; ESLint + Prettier; pre-commit hooks; conventional commits; ≥70% test coverage on critical paths.

---

## 18. Testing strategy
- **Backend (pytest):** auth utils, `classify_intent`, `_get_context`/intent execution, Whisper noise filter, OCR runner, quiz share-code; ≥70% critical-path coverage.
- **Frontend (jest/vitest):** store actions, helpers, render-by-type components, theme switching.
- **Integration:** signup→login→me; create→get→end; `voice_command`→`command_response`; `transcript_text`→DB row; `canvas_snapshot`→`whiteboard_logs`.
- **E2E (Playwright):** full teacher journey + negatives (bad password, no token, socket drop); verify both light & dark render correctly.
- **Resilience:** simulate Groq rate-limit → confirm Gemini fallback; simulate long session → confirm auto-compression + token chip.

---

## 19. Deployment — Render (free tier)
Deploy via a **`render.yaml` Blueprint** (declarative):
- **`aura-backend`** (Render Web Service, Python 3.11) — root `aura/backend/`; build installs CPU PyTorch + `requirements.txt`; start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- **`aura-db`** (Render **PostgreSQL**, free plan) — `DATABASE_URL` injected into the backend.
- **`aura-frontend`** (Render Web Service, Node) — root `aura/frontend/`; build `npm install && npm run build`; start `npm start`; linked to backend URL via `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL`.
- **TLS/routing:** Render-managed HTTPS/WSS. No Dockerfile needed (buildpacks). **No Redis.**
- **Order:** local-first sign-off → deploy DB → backend → frontend; set env vars in the Render dashboard; confirm the deploy plan with the owner before executing.

---

## 20. Environment variables (`.env`, never commit; ship `.env.example`)
```
# backend
DATABASE_URL=postgresql+psycopg://...
JWT_SECRET=...                 JWT_ALGORITHM=HS256     ACCESS_TOKEN_EXPIRE_MINUTES=480
GROQ_API_KEY=...               GEMINI_API_KEY=...
ALLOWED_ORIGINS=http://localhost:3000
COMPRESSION_TOKEN_LIMIT=10000  ENVIRONMENT=development  DEBUG=true  LOG_LEVEL=INFO
# frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_APP_NAME=Aura
```

---

## 21. Repository structure
> Everything lives under a fresh top-level `aura/` folder (see §24); the old prototype at the repo root is left untouched.
```
aura/
├─ backend/  app/{main.py, websocket/{connection,handlers}.py, workers/{llm,stt,vision,compression}_worker.py,
│            services/{ai_service,context_manager,auth,session}.py, models/, schemas/, routers/, core/{config,security,database,logging}.py}
│            alembic/  requirements.txt  .env.example
├─ frontend/ src/{app/{classroom/[id], auth, dashboard, q/[share_code]}, components/{whiteboard,audio,ai-panel,transcript,voice,classroom,shared,theme},
│            store/{authStore,sessionStore}.ts, lib/{api,websocket,exportSession}.ts, types/}  package.json  tailwind.config.ts
├─ render.yaml
└─ README.md
```

---

## 22. Acceptance criteria (definition of done)
- Teacher signs up, starts a session, sees **live Whisper transcript**, draws on the board with a **pen on a smartboard**, says **"Hey Aura, …"**, and gets the correct intent rendered in **< ~6s P95**, grounded in the actual lecture.
- All **8 intents** return valid JSON; quiz is always **exactly 5 MCQs** and shareable via QR + public page.
- Snapshots OCR every **10s**; board insights surface and can be confirmed into context.
- Context **auto-compresses** on long sessions; the **token chip** reflects it.
- **Both light & dark themes** are complete and classroom-legible; theme toggles instantly, persists, and follows OS preference on first load; board ink stays visible in both.
- Works with **stylus + touch** on a large smartboard (palm rejection, big targets, fullscreen teach mode).
- Sessions persist + restore; export works (Markdown + PDF); **Groq→Gemini fallback** engages under rate limits.
- The **stats/analytics dashboard** renders real aggregates with polished, theme-aware charts (KPIs, activity heatmap, intent mix, AI latency P50/P95, quiz analytics, topic word cloud) and has friendly empty states.
- Security bar in §16 met; only the public quiz route is unauthenticated; no secrets in code/logs.

## 23. Do these RIGHT (the throwaway prototype got them wrong — lessons, not constraints)
*Context only — so you don't repeat known mistakes. You are not bound to the old design in any way.*
1. **`format_board` as a real intent** — make it a first-class `CommandIntent` with a proper migration (the prototype hacked it onto `EXPLAIN`).
2. **No auto-compression trigger** — compression had to be called manually. Auto-trigger on token-limit overflow.
3. **No refresh tokens** — only an 8h access token. Add refresh-token rotation + short access tokens.
4. **STT is browser-only today** — implement the **Whisper** server path as the primary (browser Web Speech as fallback).
5. **Public quiz page** — backend share codes exist but the student-facing `/q/[share_code]` page was missing. Build it.
6. **In-memory context resets on restart** — acceptable for demo; consider persisting the live buffer for production.

---

## 24. Project location, design skills & quality gates (do this FIRST, before any code)
- **Fresh, isolated app folder = `aura/`.** The repo root (`/Users/ankitkumar/Aura_New`) already contains the **old throwaway prototype** (`backend/`, `frontend/`) and the report/paper files. Do **not** build into or on top of those. **Create a new top-level directory `aura/`** and put the entire new build inside it:
  ```
  Aura_New/
  ├─ aura/               ← NEW fresh build lives here, self-contained
  │  ├─ backend/
  │  ├─ frontend/
  │  └─ render.yaml
  ├─ backend/  frontend/ ← OLD prototype (reference/ignore, do NOT modify or copy)
  └─ research-paper.tex  BE_Project_Final_Report.tex  AURA_BUILD.md
  ```
- **Design/UI-quality skills (for the "sexy board" — these are DESIGN skills, not correctness tools):**
  - **impeccable** (`npx skills add pbakaus/impeccable`) — frontend design language; commands `/audit`, `/critique`, `/polish`; produces polished, production-grade UI. It saves design context to `.impeccable.md` first — fill that with Aura's audience (teachers on a smartboard), use cases, brand personality, **and the light/dark theme intent** before generating UI.
  - **emilkowalski/skill** (`npx skills add emilkowalski/skill`) — Emil Kowalski's design-engineering + animation craft; enforces motion rules (animations <300ms, custom easing, animate the right things). Use it to review/polish all UI motion and micro-interactions.
  - Use both heavily on the **frontend** (board, AI panel, quiz cards, transitions). They complement, but do **not** replace, correctness gates.
- **Correctness gates (separate from the design skills):** TypeScript strict, ESLint + Prettier, tests (§18), and `/code-review` for bug-hunting. Design skills make it *pretty*; these keep it *correct*.
- **Sequence:** create `aura/` → fill `.impeccable.md` design context → scaffold backend + frontend inside `aura/` → build features, polishing UI with the design skills as you go. Nothing is written outside `aura/` except this spec + the source documents.

---

## 25. Recommended polish & robustness toolkit (libraries)
> Beyond the skills (impeccable + emilkowalski). Concrete libraries to make Aura look great *and* be robust. Pick the best; swap with reason.

**UI system & styling** — **shadcn/ui** (Radix-based, accessible, themeable) as the component foundation; **Radix UI** primitives; **Tailwind CSS** + **class-variance-authority (cva)** + **tailwind-merge** + **clsx**; **lucide-react** icons.

**Theming (light/dark — §15.1)** — **next-themes** (system-aware, instant toggle, persisted); drives the top-bar ☀/🌙 toggle.

**Motion / micro-interactions** — **Framer Motion** (reveals, listening pulse, quiz flips); **GSAP** (advanced timelines where needed); **tailwindcss-animate**; **sonner** (toasts) + **vaul** (drawers/sheets), both by Emil Kowalski; **@formkit/auto-animate** for effortless list transitions (transcript, AI history).

**Animated component kits (for "sexy" landing/auth/empty states)** — **Aceternity UI** + **Magic UI** (drop-in flashy animated sections; pair with shadcn). Use tastefully — the classroom workspace stays calm; the marketing/auth/share pages can be bolder.

**Icons** — **lucide-react** (primary) + **Iconify** (`@iconify/react`, 200k+ icons via one API) for anything lucide lacks; Phosphor/Tabler as alternates.

**Illustrations & rich animation** — **unDraw** (free, recolor to brand accent) and **Storyset**/**Open Doodles** for spot illustrations (empty states, onboarding, the public quiz page); **Lottie** (`lottie-react`) for the "listening" hero, success ticks, and loading states. Keep all illustration palettes theme-aware (light/dark).

**"Nice cards"** → shadcn **Card** + **cva** variants + Framer Motion; each AI result is a distinct, animated card; quiz = flip-on-answer card stack.

**"Shareable links"** → quiz `share_code` + **qrcode.react** (QR) + public `/q/[share_code]` page; a "copy link" affordance with a **sonner** confirmation toast.

**"Downloads"** → **@react-pdf/renderer** (or **jsPDF** + **html2canvas**) for polished PDF export of summaries/quizzes/session; **file-saver** for the download; keep Markdown export too.

**"Tokens used"** → the context-token chip (§14) plus a small per-command token/latency badge on each AI card (show `processingTime` + token estimate) — tasteful, not clutter.

**Math & rich text** (teaching app!) → **KaTeX** (`react-katex`) for formulas; **react-markdown** + **remark-gfm** for AI markdown, with **rehype-sanitize** (XSS-safe rendering).

**Charts / data-viz (stats dashboard §15.2)** → **Tremor** (dashboard KPI cards + charts, Tailwind-native) on **Recharts**; **Nivo** for calendar heatmap, word cloud, and richer distributions. Theme-aware (light/dark).

**Animation / illustration extras** → **GSAP** (advanced timelines), **lottie-react** (vector animations), **@iconify/react** (200k icons), **Aceternity UI** / **Magic UI** (animated sections for landing/auth), **unDraw**/**Storyset** (brandable illustrations).

**Verification, testing & error skills** → built-in **`verify`** (run app + observe = smoke/sanity), **`code-review`** (bug-hunting), **`security-review`**; optional **`npx skills add AgentMantis/test-skills`** (Playwright smoke/regression/E2E). Runtime errors → **Sentry**. (Avoid unvetted community "skills"; ~73% are reportedly broken.)

**Data & forms (robustness)** — **@tanstack/react-query** (REST fetching/caching/retries); **react-hook-form** + **zod** (type-safe forms; reuse zod schemas to mirror backend Pydantic).

**Backend robustness** — **tenacity** (retry/backoff for the Groq→Gemini fallback); **slowapi** (FastAPI rate limiting); **sentry-sdk** (free, error tracking).

**Quality/CI** — ESLint + Prettier + **Husky** + **lint-staged** (pre-commit); **Vitest** + Testing Library + **Playwright**; TypeScript strict; conventional commits.

---

## 26. Prerequisites before coding + MANDATORY design-skill gate
**Owner provides / sets up (all free):**
- `GROQ_API_KEY` (console.groq.com) and `GEMINI_API_KEY` (Google AI Studio — also powers Gemini Vision OCR).
- Local **PostgreSQL** (via `docker-compose`, provided in `aura/`), **Node 20+**, **Python 3.11**. **No Redis.**
- *(optional)* Sentry DSN (errors). Whiteboard images are stored in Postgres (demo scale) — no object storage needed.
- **No MCP connectors required** for this build.

**Blocking design-skill gate (do this BEFORE writing any UI line):**
1. Install both skills: `npx skills add pbakaus/impeccable` and `npx skills add emilkowalski/skill` (then reload so they're invokable).
2. Run `/impeccable init` (or fill `.impeccable.md`) with Aura's design context: audience = teachers at a **smartboard**, classroom use cases, brand personality, and **light+dark theme** intent.
3. **Every UI element** (board, AI panel, cards, quiz, transitions, theming) must be produced/reviewed through **impeccable** (`/audit`, `/critique`, `/polish`) and the **emilkowalski** motion rules (<300ms, custom easing, animate the right things). No UI ships without passing both.
4. These design skills are for *look & motion*; correctness still goes through TypeScript strict + ESLint + tests + `/code-review`.

---

*Governing plan = `research-paper.tex` + `BE_Project_Final_Report.tex`. This document is the consolidated, corrected build contract on top of them. Build per the phases the team prefers, run locally, review continuously, and productionize on Render only after local sign-off.*
