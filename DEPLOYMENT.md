# Aura Deployment Guide

Complete guide to deploying Aura in various environments.

---

## Quick Start (Local — Docker)

### Prerequisites
- Docker & Docker Compose
- Google Gemini API Key
- `D:\Aura-Storage` folder on your host machine (for images + transcripts)

### Step 1: Clone & Configure

```bash
git clone <repository-url>
cd Aura-New
```

Edit `.env` and set your keys:
```env
GEMINI_API_KEY=your-gemini-key
JWT_SECRET=your-random-secret-key
DATABASE_URL=postgresql://aura:aura_password@postgres:5432/aura_db
LOCAL_STORAGE_PATH=/storage
```

### Step 2: Start Everything

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** — database
- **Backend** — FastAPI on port 8000
- **Frontend** — Next.js on port 3000

### Step 3: Test

1. Visit http://localhost:3000
2. Sign up → Create a session → Start teaching

---

## Production Deployment (Render)

### Architecture
```
Frontend (Vercel) → Backend (Render Web Service) → PostgreSQL (Render)
```

### Step 1: Prepare Repository

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Step 2: Deploy Database (Render)

1. Go to Render Dashboard → New → PostgreSQL
   - Name: `aura-db`
   - Plan: Free or Starter
   - Note the **Internal Database URL**

### Step 3: Deploy Backend (Render Web Service)

1. Click "New" → "Web Service"
2. Connect your Git repository
3. Configure:
   - **Name:** `aura-backend`
   - **Environment:** Python 3
   - **Build Command:** `cd backend && pip install -r requirements.txt`
   - **Start Command:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Starter ($7/month)

4. Add Environment Variables:
   ```
   DATABASE_URL      = [Internal Database URL from Step 2]
   JWT_SECRET        = [Generate a random string]
   GEMINI_API_KEY    = [Your Gemini key]
   LOCAL_STORAGE_PATH = /storage
   ALLOWED_ORIGINS   = https://your-frontend-url.com
   ENVIRONMENT       = production
   LOG_LEVEL         = INFO
   ```

5. Deploy, then initialize DB via Render Shell:
   ```bash
   python ../scripts/init_db.py
   ```

### Step 4: Deploy Frontend (Vercel)

```bash
cd frontend
npx vercel --prod
```

Set environment variables in Vercel:
```
NEXT_PUBLIC_API_URL = https://aura-backend.onrender.com
NEXT_PUBLIC_WS_URL  = wss://aura-backend.onrender.com
```

---

## Storage Setup (Cloudflare R2 — Optional for Production)

For production, replace local filesystem with Cloudflare R2:

1. Cloudflare Dashboard → R2 → Create bucket: `aura-storage`
2. Create API Token (Edit permission) — note Access Key ID & Secret
3. Add to backend environment:
   ```
   STORAGE_ENDPOINT   = https://<account-id>.r2.cloudflarestorage.com
   STORAGE_ACCESS_KEY = [R2 access key]
   STORAGE_SECRET_KEY = [R2 secret key]
   STORAGE_BUCKET     = aura-storage
   ```

---

## Monitoring & Logs

### Backend Logs (Render)
```bash
render logs -s aura-backend --tail
```

### Database Monitoring
- Render Dashboard → Database → Metrics
- Check connection pool usage

---

## Scaling

### Horizontal Scaling
- **Backend:** Render Standard ($25/month) with 2+ instances
- **Database:** Upgrade PostgreSQL plan, enable PgBouncer connection pooling

### Vertical Scaling
- Upgrade service plans on Render
- Enable Render auto-scaling

---

## Troubleshooting

### WebSocket not connecting
- Ensure frontend uses `wss://` (not `ws://`) in production
- Check CORS settings allow your frontend domain:
  ```python
  ALLOWED_ORIGINS = ["https://your-frontend-domain.com"]
  ```

### Database connection errors
```bash
psql [DATABASE_URL]  # test connection
```
- Verify `DATABASE_URL` format
- Check database is running

### AI commands not working
- Verify `GEMINI_API_KEY` is valid
- Check LLM worker logs
- Confirm context is being built (transcript/whiteboard data flowing in)

---

## Performance Optimization

### Database
```sql
CREATE INDEX idx_transcripts_session_timestamp
ON transcripts(session_id, timestamp);

CREATE INDEX idx_whiteboard_session_timestamp
ON whiteboard_logs(session_id, timestamp);
```

### Frontend
- Next.js image optimization is enabled by default
- Heavy components (Tldraw) are lazy-loaded

---

## Security Checklist

- [ ] Change `JWT_SECRET` from default
- [ ] Use HTTPS for all connections
- [ ] Set up database backups
- [ ] Configure CORS properly
- [ ] Never commit secrets — use environment variables only
- [ ] Enable Render SSL certificates
- [ ] Set up rate limiting in production

---

## Cost Estimate

### Free Tier
| Service      | Cost               |
|--------------|--------------------|
| Frontend     | $0 (Vercel)        |
| Backend      | $0 (with sleep)    |
| Database     | $0 (90-day trial)  |
| R2 Storage   | $0 (under 10GB)    |
| Gemini       | $0 (free tier)     |
| **Total**    | **$0/month**       |

### Recommended (No sleep)
| Service      | Cost               |
|--------------|--------------------|
| Backend      | $7/month           |
| Database     | $7/month           |
| **Total**    | **~$14/month**     |

---

## Backup & Recovery

### Automated Backups (Render)
- Daily automatic backups, 7-day retention
- Manual: Dashboard → Database → Backups

### Manual Backup
```bash
pg_dump [DATABASE_URL] > backup.sql   # backup
psql [DATABASE_URL] < backup.sql      # restore
```

---

## Maintenance

### Weekly
- Check error logs
- Monitor API usage

### Monthly
- Update dependencies
- Review database size
- Optimize slow queries

---

**Built with ❤️ for educators — co-authored by Ankit Kumar and Cursor**
