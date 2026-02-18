# 🎓 Aura: AI-Powered Multi-Modal Teaching Assistant

> Transform your smartboard lectures with real-time AI assistance. Generate quizzes, summaries, and interactive content instantly.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11-yellow)](https://www.python.org/)

---

## 📌 Overview

**Aura** solves the "deaf whiteboard problem" by fusing what teachers **say** with what they **draw** in real-time. When you draw a diagram and say "This is a perceptron," Aura understands the relationship between the visual and speech, creating intelligent context that enables powerful AI features.

### The Problem
- Digital whiteboards and recording systems don't communicate
- A drawing without explanation is meaningless
- Teachers must create quizzes/summaries manually after class
- Existing tools capture pixels, not semantic meaning

### Our Solution
Unified platform that listens, watches, understands, and assists in real-time during lectures.

---

## ⚡ Key Features

### Core Functionality
- **Real-Time Transcription** - Speech-to-text using OpenAI Whisper
- **Visual Understanding** - OCR + shape detection on whiteboard
- **Context Fusion** - Temporal alignment of speech and visuals
- **Voice Commands** - "Hey Aura" triggers AI actions instantly
- **Smart Compression** - Auto-summarizes when buffer fills (10k tokens)
- **Session Memory** - Maintains short-term + long-term context

### AI-Powered Features
- **Quiz Generation** - Create MCQs from lecture content
- **Summarization** - Condense sections into bullet points
- **Concept Explanation** - Answer "explain X" questions
- **Example Generation** - Provide real-world examples
- **Diagram Analysis** - Understand and reference visuals

### Student Features
- **Live Quiz Participation** - QR code/link access, no login
- **Real-Time Results** - Instant feedback and leaderboards
- **Session Replay** - Review with synchronized transcript and drawings

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                      │
│  Whiteboard (tldraw) + Audio Capture + AI Response Panel    │
└──────────────────┬──────────────────────────────────────────┘
                   │ WebSocket
┌──────────────────┴──────────────────────────────────────────┐
│                   API GATEWAY (FastAPI)                      │
│         REST API + WebSocket + Authentication                │
└──────────────────┬──────────────────────────────────────────┘
                   │ Redis Streams
┌──────────────────┴──────────────────────────────────────────┐
│                    WORKER POOL (Python)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   STT    │  │  Vision  │  │   LLM    │  │Compress  │   │
│  │(Whisper) │  │  (OCR)   │  │ (Gemini) │  │          │   │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘   │
│        └─────────────┴──────────────┴──────────────┘        │
│                    Fusion Worker                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────────┐
│        PostgreSQL (8 tables) + Redis (cache/queues)         │
│              S3/R2 Storage (audio/images)                    │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, tldraw, Socket.IO
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, Redis, Socket.IO
- **AI/ML:** OpenAI Whisper, Google Gemini, EasyOCR
- **Infrastructure:** Docker, Uvicorn, Boto3 (S3/R2)

---

## 🚀 Quick Start (15 Minutes)

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org))
- Python 3.11+ ([Download](https://python.org))
- Docker Desktop ([Download](https://docker.com))
- OpenAI API Key ([Get here](https://platform.openai.com/api-keys))
- Google Gemini API Key ([Get here](https://makersuite.google.com/app/apikey))

### Installation

**1. Clone and Configure**
```bash
git clone <repository-url>
cd Aura-New

# Copy environment template
cp .env.example .env
```

**2. Add API Keys to .env**
```env
OPENAI_API_KEY=sk-...              # Your OpenAI key
GEMINI_API_KEY=AI...               # Your Gemini key
JWT_SECRET=your-random-secret-key   # Any random string
```

**3. Start Infrastructure**
```bash
docker-compose up -d postgres redis
```

**4. Setup Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Initialize database
cd ..
python scripts/init_db.py
```

**5. Start Services (3 separate terminals)**

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 - Workers:**
```bash
source backend/venv/bin/activate
python scripts/run_workers.py
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**6. Access Application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 🎓 First Session Tutorial

### Step 1: Create Account
1. Visit http://localhost:3000
2. Click "Get Started" → Sign Up
3. Fill in details, select "Teacher"
4. Click "Create Account"

### Step 2: Start Teaching
1. Click "New Session" from Dashboard
2. Enter subject name
3. Click "Start" button
4. Allow microphone access
5. Draw and speak naturally

### Step 3: Try AI Commands
```
Say: "Hey Aura, make a quiz on what we just covered"
Say: "Hey Aura, summarize this section"
Say: "Hey Aura, explain neural networks in simple terms"
Say: "Hey Aura, give me an example"
```

Wait 5-10 seconds, and the AI response appears on the right panel!

### Step 4: Share with Students
1. Generate a quiz
2. Click "Share" button
3. Show QR code or share link
4. Students access without login

---

## 📁 Project Structure

```
Aura-New/
├── frontend/                    # Next.js 14 + TypeScript
│   ├── src/
│   │   ├── app/                # Pages (landing, auth, dashboard, classroom)
│   │   ├── components/         # Reusable components (whiteboard, AI panel, etc.)
│   │   ├── types/              # TypeScript type definitions
│   │   ├── store/              # State management (Zustand)
│   │   ├── lib/                # API & WebSocket clients
│   │   └── hooks/              # Custom React hooks
│   └── [config files]          # next.config.js, tailwind.config.ts, etc.
│
├── backend/                     # FastAPI + Python
│   ├── app/
│   │   ├── main.py            # FastAPI application entry
│   │   ├── core/              # Config, database, Redis, security
│   │   ├── models/            # 8 SQLAlchemy models
│   │   ├── api/               # REST endpoints (auth, sessions, quiz)
│   │   ├── websocket/         # Socket.IO handlers
│   │   ├── services/          # Business logic (AI, context, storage)
│   │   └── workers/           # Background processors (STT, Vision, LLM, etc.)
│   └── requirements.txt       # Python dependencies
│
├── scripts/                    # Utility scripts
│   ├── init_db.py             # Database initialization
│   └── run_workers.py         # Worker launcher
│
├── docker-compose.yml         # Local development setup
├── .env.example              # Environment template
└── README.md                 # This file
```

---

## 🗄️ Database Schema

**Core Tables:**
- `users` - Authentication and profiles
- `sessions` - Lecture sessions with compressed history
- `transcripts` - Speech-to-text logs
- `whiteboard_logs` - Canvas snapshots + OCR data
- `fusion_events` - Links between speech and visuals
- `commands` - AI command execution logs
- `quizzes` - Generated quizzes for sharing
- `quiz_attempts` - Student quiz submissions

**Key Relationships:**
- Sessions contain many transcripts and whiteboard logs
- Fusion events link transcripts to whiteboard logs
- Commands generate quizzes
- Quizzes have many attempts

---

## 🔄 How It Works

### Data Flow Pipeline

**1. Real-Time Capture:**
- Audio: 5-second chunks → WebSocket → STT Worker → Transcript → DB
- Visual: Canvas snapshots (2-sec idle) → WebSocket → Vision Worker → OCR → DB

**2. Context Fusion:**
- Fusion Worker maintains sliding windows (last 10 transcripts, last 5 images)
- Detects temporal proximity (±10 seconds)
- Identifies linguistic cues ("this", "here", "look at")
- Creates fusion links between speech and visuals
- Updates active buffer in Redis

**3. Buffer Management:**
- Token counting on every update (10k token limit)
- When limit hit → Trigger compression
- Compression Worker summarizes using Gemini Flash
- Fallback to keyword extraction if LLM fails
- Teacher notified, buffer cleared, lecture continues

**4. Command Execution:**
- Teacher says "Hey Aura, [command]"
- Intent classified (quiz, summary, explain, etc.)
- LLM Worker fetches full context (compressed history + active buffer)
- Gemini Pro generates response
- Result sent via WebSocket to frontend
- Displayed in AI panel

---

## 🛠️ Development

### Local Development Workflow

**Frontend Changes:**
```bash
cd frontend
# Edit files in src/
# Hot reload is automatic
npm run type-check  # Check TypeScript
npm run lint        # Lint code
```

**Backend Changes:**
```bash
cd backend
# Edit files in app/
# Server auto-reloads
black app/    # Format code
mypy app/     # Check types
```

### Database Operations
```bash
# Connect to database
docker exec -it aura-new-postgres-1 psql -U aura_user -d aura_db

# Inside psql:
\dt                    # List tables
SELECT * FROM users;   # Query data
\q                     # Exit
```

### Check Logs
```bash
# Backend logs: Check terminal running uvicorn
# Workers logs: Check terminal running workers
# Frontend logs: Browser console (F12)
# Docker logs:
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

## 🐛 Troubleshooting

### Issue: Module not found
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: Database connection refused
```bash
docker-compose up -d postgres
python scripts/init_db.py
```

### Issue: Redis connection refused
```bash
docker-compose up -d redis
docker exec -it aura-new-redis-1 redis-cli ping  # Should return PONG
```

### Issue: Port already in use
```bash
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:8000 | xargs kill -9
```

### Issue: Workers not processing
```bash
# Check Redis connection
docker exec -it aura-new-redis-1 redis-cli ping

# Check worker logs (terminal running workers)
# Restart workers: Ctrl+C then python scripts/run_workers.py
```

### Issue: Microphone not working
1. Check browser permissions (click lock icon in address bar)
2. Allow microphone access
3. Refresh page
4. Try different browser (Chrome recommended)

### Issue: AI commands not responding
- Verify API keys in .env are correct
- Check Gemini API quota limits
- Check LLM worker logs for errors
- Ensure workers are running

### Emergency Reset
```bash
# Stop everything
docker-compose down -v

# Clear caches
find . -type d -name __pycache__ -exec rm -r {} +
rm -rf backend/venv frontend/node_modules

# Reinstall
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm install

# Restart
docker-compose up -d postgres redis
python scripts/init_db.py
```

---

## 📊 API Endpoints

### Authentication
```
POST   /api/auth/signup   - Create account
POST   /api/auth/login    - Get JWT token
GET    /api/auth/me       - Get current user
```

### Sessions
```
POST   /api/sessions         - Create session
GET    /api/sessions         - List sessions (paginated)
GET    /api/sessions/{id}    - Get session details
PATCH  /api/sessions/{id}    - Update session
POST   /api/sessions/{id}/end - End session
DELETE /api/sessions/{id}    - Delete session
```

### Quizzes (Public)
```
GET  /api/quiz/{code}          - Get quiz (no auth)
POST /api/quiz/{code}/submit   - Submit answers
GET  /api/quiz/{code}/results  - Get results (teacher only)
```

### WebSocket Events
```
Client → Server:
  - audio_chunk       - Audio stream
  - canvas_snapshot   - Whiteboard drawing
  - voice_command     - AI command

Server → Client:
  - transcript_update       - New transcription
  - compression_started     - Buffer compressing
  - compression_complete    - Compression done
  - command_response        - AI response ready
  - error                   - Error occurred
```

---

## 🎨 Customization

### Change UI Theme
Edit `frontend/tailwind.config.ts`:
```typescript
colors: {
  primary: {
    500: '#your-brand-color',
  }
}
```

### Change Wake Word
Edit `backend/app/workers/llm_worker.py`:
```python
if "hey aura" in command_text.lower():
    # Change to your preferred wake word
```

### Adjust Token Limit
Edit `backend/app/core/config.py`:
```python
COMPRESSION_TOKEN_LIMIT: int = 10000  # Change as needed
```

---

## 🔒 Security

- JWT authentication with secure token handling
- HTTPS for all connections in production
- CORS configured properly
- Input validation with Pydantic
- Password hashing with bcrypt
- Rate limiting ready for production
- Environment variables for secrets

---

## 💰 Cost Estimate

### Beta Phase (50 teachers, 10 sessions/month):
- Frontend: $0 (Vercel/Render free)
- Backend: $7/month or $0 (with sleep)
- Database: $7/month (after 90-day trial)
- Redis: $0 (free tier)
- Storage: $0 (under 10GB)
- Whisper API: ~$180/month (500 hours @ $0.36/hour)
- Gemini: $0 (free tier)

**Total: ~$190-200/month** for 500 lecture hours

### Scaling (100 teachers):
- Infrastructure: ~$50/month
- Whisper: ~$360/month (1000 hours)
- **Total: ~$410/month**

---

## 🚀 Production Deployment

For detailed production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick overview:
1. Deploy PostgreSQL + Redis on Render
2. Deploy Backend Web Service on Render
3. Deploy Workers as Background Worker on Render
4. Deploy Frontend on Vercel
5. Setup Cloudflare R2 for storage
6. Configure environment variables
7. Initialize database

---

## 📝 Testing Checklist

- [ ] Start all services (Docker, Backend, Workers, Frontend)
- [ ] Create account at http://localhost:3000
- [ ] Login successfully
- [ ] Create new session
- [ ] Start recording (allow microphone)
- [ ] Draw on whiteboard
- [ ] Speak and verify audio capture
- [ ] Say "Hey Aura, make a quiz"
- [ ] Verify quiz appears in AI panel
- [ ] Share quiz link
- [ ] Test quiz submission as student
- [ ] End session
- [ ] Verify session in dashboard

---

## 🎯 Features Roadmap

**Current (v1.0):**
- ✅ Real-time transcription
- ✅ Visual understanding (OCR)
- ✅ Context fusion
- ✅ Voice commands
- ✅ Quiz generation
- ✅ Summary generation
- ✅ Student quiz access

**Planned (v2.0):**
- Advanced fusion with semantic analysis
- Multi-language support
- Offline mode with local Whisper
- Session analytics dashboard
- Mobile apps (React Native)
- Export to PDF with diagrams
- Integration with LMS platforms
- Screen recording

---

## 🤝 Contributing

1. Follow existing code style
2. Write clean, self-documenting code
3. Add TypeScript types for all interfaces
4. Use Python type hints
5. Test thoroughly before committing
6. Update documentation for new features

### Code Standards
- TypeScript: Strict mode, functional components
- Python: PEP 8, type hints, docstrings
- Git: Descriptive commit messages
- Comments: Only for non-obvious logic

---

## 📞 Support

**Documentation:**
- README.md (this file) - Complete guide
- DEPLOYMENT.md - Production deployment
- API docs: http://localhost:8000/docs (when running)

**Common Issues:**
- Check Docker containers are running: `docker-compose ps`
- Verify environment variables in .env
- Check logs in respective terminals
- Ensure API keys are valid

---

## 📄 License

**Status:** To be determined

**Options:**
- Open source (MIT/Apache)
- Commercial license
- Hybrid model

---

## 🙏 Acknowledgments

Built with:
- Next.js by Vercel
- FastAPI by Sebastián Ramírez
- tldraw by tldraw team
- OpenAI Whisper
- Google Gemini
- And many other amazing open-source projects

---

## 🎓 For Educators

Aura is built specifically for teachers who want to:
- Focus on teaching, not administrative tasks
- Leverage AI without technical expertise
- Engage students with interactive content
- Save time on quiz and summary creation
- Capture and share knowledge effectively

**Transform your smartboard into an intelligent teaching assistant.** 🚀

---

**Built with ❤️ for educators worldwide**
