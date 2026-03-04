# Aura — Deploy to the internet (plan)

One-page plan: **where** to host and **how** to go live.

---

## Where to host

| Piece      | Recommended        | Why |
|------------|--------------------|-----|
| **Frontend** | **Vercel**         | Free, great for Next.js, global CDN. |
| **Backend**  | **Render (Docker)**| Your backend uses PyTorch + EasyOCR + ffmpeg → needs **Docker**; Render supports "Docker" web services. |
| **Database** | **Render PostgreSQL** | Easiest with Render backend (same provider, internal URL). Free 90-day trial or ~$7/mo. |
| **Storage**  | **Render disk** or **Cloudflare R2** | Backend writes images/transcripts. Render filesystem is ephemeral; for real persistence use R2 (or add a volume if Render supports it). |

**Alternative:** Deploy **everything (backend + frontend + DB)** on **Railway** or **Fly.io** with Docker Compose if you prefer one platform.

---

## Architecture (recommended)

```
[User] → https://your-app.vercel.app (Vercel)
              ↓ HTTPS
         https://aura-backend.onrender.com (Render Docker)
              ↓
         Render PostgreSQL (internal)
         Optional: R2 for /storage
```

- Frontend talks to backend over **HTTPS**.
- WebSockets use **wss://** (same host as API).
- No `confirm()` / browser dialogs; all in-app (already done).

---

## How — step by step

### 1. Repo and env checklist

- [ ] Code pushed to GitHub (or GitLab).
- [ ] `.env` is in `.gitignore` (never commit secrets).
- [ ] You have: **GROQ_API_KEY**, **GEMINI_API_KEY** (fallback), **JWT_SECRET** (strong random string).

### 2. Database (Render)

1. **Render** → New → **PostgreSQL**.
2. Name: `aura-db`, region closest to you.
3. Create, then copy **Internal Database URL** (use this only in Render; not the external URL for backend on same Render account).

### 3. Backend (Render, Docker)

1. **Render** → New → **Web Service**.
2. Connect repo, branch (e.g. `main`).
3. **Important:** Choose **Docker** (not “Python”).  
   - **Dockerfile path:** `backend/Dockerfile`  
   - **Root directory:** leave empty or set to repo root so Docker build context can see `backend/`.
4. Render usually detects port from `EXPOSE 8000`; if not, set **Port:** `8000`.
5. **Environment variables** (in Render dashboard):

   - `DATABASE_URL` = *(Internal Database URL from step 2)*
   - `JWT_SECRET` = *(random secret, e.g. `openssl rand -hex 32`)*
   - `GROQ_API_KEY` = *(your Groq key)*
   - `GEMINI_API_KEY` = *(your Gemini key, optional fallback)*
   - `LOCAL_STORAGE_PATH` = `/storage`
   - `ENVIRONMENT` = `production`
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app` *(replace with your real Vercel URL later)*
   - `LOG_LEVEL` = `INFO`

6. **Optional:** If you add R2 later: `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`.
7. Deploy. Note the backend URL, e.g. `https://aura-backend.onrender.com`.

**If Render build fails:** Ensure Docker build context is correct. Some setups need **Root Directory** = `backend` and **Dockerfile path** = `Dockerfile`, or repo root with **Dockerfile path** = `backend/Dockerfile` (depending on how Render treats context).

### 4. Frontend (Vercel)

1. **Vercel** → New Project → Import your repo.
2. **Framework:** Next.js (auto).
3. **Root Directory:** `frontend`.
4. **Build / dev:** leave default (e.g. `npm run build`, `npm run start` or dev).
5. **Environment variables:**

   - `NEXT_PUBLIC_API_URL` = `https://aura-backend.onrender.com`
   - `NEXT_PUBLIC_WS_URL`  = `wss://aura-backend.onrender.com`

6. Deploy. Note the URL, e.g. `https://aura-xxx.vercel.app`.

### 5. Wire backend to frontend

1. In **Render** (backend), set:
   - `ALLOWED_ORIGINS` = `https://aura-xxx.vercel.app` (your real Vercel URL).
2. Redeploy backend if needed so CORS and WebSocket allow your frontend origin.

### 6. Database migrations

Backend should run migrations on startup (check `main.py`). If not, run them once via Render Shell:

- Open backend service → Shell, then e.g.:
  - `python -c "from app.core.database import Base, engine; from app.models import *; Base.metadata.create_all(bind=engine)"`
  - Or use Alembic if you have it: `alembic upgrade head`.

### 7. Storage (production)

- **Render:** Instance filesystem is ephemeral; anything in `/storage` is lost on redeploy. Fine for a first deploy to test.
- **For persistence:** Add **Cloudflare R2** (or S3) and configure backend env vars (see your existing DEPLOYMENT.md “Storage Setup (Cloudflare R2)”). Then backend uses R2 instead of local path when those vars are set.

---

## Cost (ballpark)

- **Vercel:** Free (hobby) or Pro.
- **Render backend (Docker):** Free tier can spin down; ~$7/mo for always-on.
- **Render PostgreSQL:** Free 90-day trial; then ~$7/mo.
- **R2:** Free tier usually enough to start.
- **Total:** **$0** (with free tiers / spin-down) or **~$14/mo** for always-on backend + DB.

---

## After deploy

- [ ] Open `https://your-app.vercel.app` → sign up → create session → test Aura (quiz/summary).
- [ ] Check WebSocket: open Aura panel, send a command; if it never loads, check browser console for `wss://` errors and CORS.
- [ ] Set up a custom domain (optional) in Vercel and Render.
- [ ] Add R2 (or S3) when you need persistent storage for images/transcripts.

---

## Quick reference

| What        | Where / value |
|------------|----------------|
| Frontend   | Vercel, root `frontend` |
| Backend    | Render **Docker** service, `backend/Dockerfile` |
| Database   | Render PostgreSQL (internal URL in backend) |
| API base   | `https://<your-backend>.onrender.com` |
| WebSocket  | `wss://<your-backend>.onrender.com` |
| CORS       | `ALLOWED_ORIGINS` = your Vercel URL |

Once this is done, we can refine (e.g. custom domain, R2, or moving to a single-platform Docker deploy). For “build and deploy on the internet,” this is the plan.
