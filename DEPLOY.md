# Deploying Aura on Render (free tier)

Three services, defined in [`render.yaml`](render.yaml): **aura-db** (Postgres),
**aura-backend** (FastAPI + Socket.IO), **aura-frontend** (Next.js). The backend
runs migrations + an idempotent demo seed on every boot.

## 0. Prerequisites
- A Render account (✓).
- A **GROQ_API_KEY** — free at <https://console.groq.com>. Required for AI features.
  (`GEMINI_API_KEY` is an optional fallback.)
- This repo on GitHub (`Andromeda0007/Aura`), `render.yaml` on **main**.

## 1. Connect the repo (one-time)
Render → **New → Blueprint** → connect/authorize GitHub → pick the **Aura** repo.

## 2. Apply the Blueprint
Render reads `render.yaml` and proposes the 3 services + DB. Click **Apply**.
The first build runs automatically. Expect the frontend to come up still pointing
at `localhost` and the backend to reject it via CORS — both are fixed in step 3
(cross-service URLs aren't known until the services exist).

## 3. Set secrets + cross-URLs
Note the real URLs from the dashboard (normally `https://aura-backend.onrender.com`
and `https://aura-frontend.onrender.com` — Render appends a suffix only if the name
was already taken).

**aura-backend → Environment:**
| Key | Value |
|-----|-------|
| `GROQ_API_KEY` | your Groq key |
| `GEMINI_API_KEY` | optional |
| `ALLOWED_ORIGINS` | `https://aura-frontend.onrender.com` (exact, no trailing slash) |

Save → the backend restarts and picks these up.

**aura-frontend → Environment:**
| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://aura-backend.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `https://aura-backend.onrender.com` |

⚠️ `NEXT_PUBLIC_*` are **inlined at build time**. After saving, do
**Manual Deploy → Clear build cache & deploy** — a plain restart will *not* pick them up.

## 4. Verify
- `GET /health` → `{"status":"ok"}`
- `GET /health/db` → `{"database":"reachable"}`
- Open the frontend and log in:
  - **admin** — `ankit@gmail.com` / `admin-password`
  - **teacher** — `sagarrane@gmail.com` / `teacher-password`
- Backend logs show `seed.admin_created` and `seed_demo done: {...}`.

## Notes
- **Free tier**: services sleep after ~15 min idle (~50 s cold start). Free Postgres
  expires after 90 days (1 GB cap). Upgrade the plans in `render.yaml` when needed.
- **Auto-deploy**: pushes to `main` redeploy automatically.
- The demo seed is idempotent — re-running it never duplicates data.
- `/docs` is disabled in production (`DEBUG=false`).
- `DATABASE_URL` is auto-wired from `aura-db`; the app rewrites it to the psycopg3
  driver, so the managed `postgresql://` URL connects without extra config.
