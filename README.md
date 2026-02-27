# Aura — AI-Powered Teaching Assistant

A full-stack AI classroom assistant that transcribes speech in real-time, captures whiteboard drawings via OCR, and responds to natural-language commands with quizzes, summaries, explanations, diagrams, and interactive problem sets — all during a live lecture.

---

## Features

| Capability | Details |
|---|---|
| **Live Transcription** | Chrome Web Speech API → instant transcript panel (toggleable) |
| **Whiteboard OCR** | tldraw canvas auto-snapshot → EasyOCR → text fed into AI context |
| **Voice Commands** | Say *"Hey Aura…"* or type a command in the footer input |
| **Quiz Generation** | AI generates multiple-choice quizzes with instant correct/wrong feedback |
| **Summaries** | Structured summary of the lecture so far |
| **Explanations & Answers** | Concept explanations drawn from live context |
| **Interactive Problems** | AI generates a numerical/problem, student submits answer, Groq validates it and shows step-by-step solution |
| **Diagram Generation** | Mermaid diagrams (flowcharts, sequences, ER, mindmaps, state, timelines) + PubChem molecular structures for chemistry |
| **Response History** | Separate History tab in the AI panel — all past responses preserved per session, click any to revisit |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, tldraw v2, Framer Motion, Zustand |
| Backend | FastAPI, SQLAlchemy 2, PostgreSQL, Socket.IO, Pydantic v2 |
| AI Provider | Groq (llama-3.1-8b-instant / llama-3.3-70b-versatile) with Gemini fallback |
| Diagrams | Mermaid.js (client-side) + PubChem REST API (molecular structures) |
| OCR | EasyOCR (whiteboard image → text) |
| Auth | JWT + Argon2 password hashing |
| Infra | Docker, Docker Compose |

---

## Architecture

```
Browser
  ├── Web Speech API ─────────────────────────────────────┐
  │     └── Live transcript panel                         │
  │     └── "Hey Aura" detection → voice command          │
  │                                                        ▼
  ├── tldraw Whiteboard                          FastAPI + Socket.IO
  │     └── PNG snapshot every 30s → WebSocket         │
  │                                                     ├── stt_worker     → saves transcripts to DB
  └── Footer text input → voice_command event          ├── vision_worker  → EasyOCR → whiteboard_logs
                                                        └── llm_worker     → Groq → AI response → panel
```

### Command Flow

```
User command (voice or typed)
  → classify_intent  (llama-3.1-8b-instant, fast)
  → build context    (last 30 transcripts + last 5 OCR snapshots)
  → execute intent   (llama-3.3-70b-versatile, smart)
       ├── generate_quiz       → QuizDisplay (interactive MCQ)
       ├── summarize           → SummaryDisplay
       ├── explain             → ExplanationDisplay
       ├── generate_example    → ExplanationDisplay with answer input + AI validation
       ├── generate_diagram    → DiagramDisplay (Mermaid or PubChem)
       └── answer_question     → ExplanationDisplay
  → WebSocket → AI Panel (Response tab, added to History)
```

---

## Project Structure

```
Aura-New/
├── frontend/src/
│   ├── app/                        # Pages: landing, auth, dashboard, classroom
│   ├── components/
│   │   ├── audio/AudioCapture.tsx       # Web Speech API + "Hey Aura" detection
│   │   ├── whiteboard/WhiteboardCanvas.tsx  # tldraw + 30s auto-snapshot
│   │   ├── transcript/LiveTranscript.tsx    # Toggleable transcript panel
│   │   └── ai-panel/
│   │       ├── AIPanel.tsx              # Response / History tabs
│   │       ├── QuizDisplay.tsx          # Interactive MCQ with instant feedback
│   │       ├── SummaryDisplay.tsx
│   │       ├── ExplanationDisplay.tsx   # Explanation + interactive problem validation
│   │       └── DiagramDisplay.tsx       # Mermaid renderer + PubChem chemistry
│   ├── lib/
│   │   ├── api.ts                   # Axios client (auth, sessions, validate-answer)
│   │   └── websocket.ts             # Socket.IO client
│   └── store/sessionStore.ts        # Zustand (session, transcript, AI history)
│
├── backend/app/
│   ├── main.py                      # FastAPI + Socket.IO + startup DB migrations
│   ├── models/                      # SQLAlchemy models (users, sessions, commands, quizzes…)
│   ├── api/                         # REST: auth, sessions, quiz, validate-answer
│   ├── websocket/                   # Socket.IO server + event handlers
│   ├── workers/
│   │   ├── llm_worker.py            # Intent classification + Groq execution
│   │   ├── stt_worker.py            # Transcript persistence
│   │   ├── vision_worker.py         # EasyOCR pipeline
│   │   └── compression_worker.py    # Context window compression
│   └── services/
│       └── ai_service.py            # Groq/Gemini wrapper (classify, quiz, summary,
│                                    #   explain, example, diagram, validate_answer)
│
├── docker-compose.yml
└── .env
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Auth, profiles |
| `sessions` | Lecture sessions, compressed context history |
| `transcripts` | Per-sentence speech log |
| `whiteboard_logs` | Canvas snapshots + OCR text |
| `commands` | Every AI command with intent, response, and timing |
| `quizzes` | Generated quizzes (shareable via code) |
| `quiz_attempts` | Student quiz submissions |
| `fusion_events` | Speech ↔ visual correlation events |

---

## Quick Start

**Prerequisites:** Docker Desktop, Chrome browser, Groq API key (free at [console.groq.com](https://console.groq.com))

**1. Clone and configure `.env`:**
```env
DATABASE_URL=postgresql://aura_user:aura_dev_password@localhost:5432/aura_db
JWT_SECRET=your-random-secret-key
GROQ_API_KEY=your-groq-key
LOCAL_STORAGE_PATH=/storage
ENVIRONMENT=development
```

**2. Create host storage folders:**
```
D:/Aura-Storage/Images/
D:/Aura-Storage/Transcripts/
```

**3. Start:**
```bash
docker-compose up -d
```

**4. Open:** http://localhost:3000

---

## Usage

1. Sign up and create a session from the Dashboard
2. Click **Start** — microphone permission required (Chrome/Edge only)
3. Speak and draw on the whiteboard freely
4. Use the footer input or say **"Hey Aura…"** followed by a command:

| Example command | What Aura does |
|---|---|
| *"generate a quiz on Newton's laws"* | Interactive MCQ with explanations |
| *"summarize the lecture so far"* | Structured summary |
| *"explain Bernoulli's principle"* | Detailed explanation |
| *"give me a numerical on projectile motion"* | Problem + answer input + AI validation |
| *"draw the diagram of benzene"* | PubChem molecular structure image |
| *"flowchart of the water cycle"* | Mermaid flowchart diagram |

5. Use the **Response** / **History** tabs in the AI panel to navigate responses
6. Toggle **Transcript** in the footer to view the live speech log

---

## API Endpoints

```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me

POST   /api/sessions
GET    /api/sessions
GET    /api/sessions/{id}
GET    /api/sessions/{id}/transcripts
POST   /api/sessions/{id}/end
POST   /api/sessions/{id}/validate-answer
DELETE /api/sessions/{id}

GET    /api/quiz/{code}
POST   /api/quiz/{code}/submit
```

---

## AI Rate Limits (Groq Free Tier)

| Model | Used for | RPM | Daily |
|---|---|---|---|
| `llama-3.1-8b-instant` | Intent classification, answer validation | 30 | 14,400 |
| `llama-3.3-70b-versatile` | Quiz, summary, explanation, diagram generation | 30 | 1,000 |

Hitting limits returns a `429` — no charges ever on the free tier.

---

## Troubleshooting

**No transcript:** Use Chrome or Edge. Check microphone permissions.

**WebSocket disconnects:** JWT may have expired — log out and back in.

**Diagram blank:** Ensure the frontend container restarted after the latest build (`docker-compose up -d`).

**Check logs:**
```bash
docker logs aura-new-backend-1 --tail 50
docker logs aura-new-frontend-1 --tail 20
```
