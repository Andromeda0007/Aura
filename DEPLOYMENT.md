# Aura Deployment Guide

Complete guide to deploying Aura in various environments.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- OpenAI API Key (for Whisper)
- Google Gemini API Key

### Step 1: Clone & Configure

```bash
# Clone repository
git clone <repository-url>
cd Aura-New

# Copy environment file
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
JWT_SECRET=your-random-secret-key
```

### Step 2: Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Verify services
docker-compose ps
```

### Step 3: Initialize Database

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt

# Initialize database
python ../scripts/init_db.py
```

### Step 4: Start Backend

```bash
# In backend directory with venv activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be at: http://localhost:8000

### Step 5: Start Workers (Separate Terminal)

```bash
# In project root with backend venv activated
python scripts/run_workers.py
```

### Step 6: Start Frontend

```bash
cd frontend
npm install
cp .env.example .env.local

# Edit .env.local if needed
npm run dev
```

Frontend will be at: http://localhost:3000

### Step 7: Test

1. Visit http://localhost:3000
2. Click "Get Started" → Sign up
3. Create a new session
4. Start teaching!

---

## Production Deployment (Render)

### Architecture
```
Frontend (Vercel/Render Static) → Backend (Render Web Service) → PostgreSQL/Redis (Render)
                                          ↓
                                    Workers (Render Background)
```

### Step 1: Prepare Repository

Ensure `.env.example` is committed (without secrets).

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Step 2: Deploy Database (Render)

1. Go to Render Dashboard
2. Create **PostgreSQL** database
   - Name: `aura-db`
   - Plan: Free or Starter
   - Note the **Internal Database URL**

3. Create **Redis** instance
   - Name: `aura-redis`
   - Plan: Free
   - Note the **Internal Redis URL**

### Step 3: Deploy Backend (Render Web Service)

1. Click "New" → "Web Service"
2. Connect your Git repository
3. Configure:
   - **Name:** `aura-backend`
   - **Environment:** Python 3
   - **Build Command:** `cd backend && pip install -r requirements.txt`
   - **Start Command:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Starter ($7/month) or Free with sleep

4. Add Environment Variables:
   ```
   DATABASE_URL = [Internal Database URL from Step 2]
   REDIS_URL = [Internal Redis URL from Step 2]
   JWT_SECRET = [Generate random string]
   OPENAI_API_KEY = [Your OpenAI key]
   GEMINI_API_KEY = [Your Gemini key]
   STORAGE_ENDPOINT = [Cloudflare R2 endpoint]
   STORAGE_ACCESS_KEY = [R2 access key]
   STORAGE_SECRET_KEY = [R2 secret key]
   STORAGE_BUCKET = aura-storage
   ALLOWED_ORIGINS = https://your-frontend-url.com
   ENVIRONMENT = production
   LOG_LEVEL = INFO
   ```

5. Deploy

6. After deployment, initialize database:
   - Go to Shell tab
   - Run: `python ../scripts/init_db.py`

### Step 4: Deploy Workers (Render Background Worker)

1. Click "New" → "Background Worker"
2. Connect same repository
3. Configure:
   - **Name:** `aura-workers`
   - **Environment:** Python 3
   - **Build Command:** `cd backend && pip install -r requirements.txt`
   - **Start Command:** `python scripts/run_workers.py`

4. Use **same environment variables** as backend

5. Deploy

### Step 5: Deploy Frontend (Vercel)

1. Install Vercel CLI: `npm i -g vercel`
2. In frontend directory:
   ```bash
   cd frontend
   vercel
   ```

3. Configure:
   - Project name: `aura-frontend`
   - Environment variables:
     ```
     NEXT_PUBLIC_API_URL = https://aura-backend.onrender.com
     NEXT_PUBLIC_WS_URL = wss://aura-backend.onrender.com
     ```

4. Deploy:
   ```bash
   vercel --prod
   ```

**Alternative: Deploy Frontend on Render Static Site**

1. Click "New" → "Static Site"
2. Connect repository
3. Configure:
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Publish Directory:** `frontend/out`
   - Add environment variables

---

## Storage Setup (Cloudflare R2)

### Why R2?
- Free 10GB storage
- Zero egress fees
- S3-compatible API

### Setup Steps

1. Go to Cloudflare Dashboard → R2
2. Create bucket: `aura-storage`
3. Create API Token:
   - Permission: Edit
   - Note: Access Key ID & Secret Access Key
4. Get endpoint URL (format: `https://<account-id>.r2.cloudflarestorage.com`)

5. Add to environment variables in Render

---

## Monitoring & Logs

### Backend Logs (Render)
```bash
# View logs
render logs -s aura-backend

# Stream logs
render logs -s aura-backend --tail
```

### Worker Logs
```bash
render logs -s aura-workers --tail
```

### Database Monitoring
- Render Dashboard → Database → Metrics
- Check connection pool usage
- Monitor query performance

### Redis Monitoring
- Render Dashboard → Redis → Metrics
- Check memory usage
- Monitor command rate

---

## Scaling

### Horizontal Scaling (Handle more load)

**Backend:**
- Render: Upgrade to Standard ($25/month) with 2+ instances
- Workers: Create multiple worker services

**Database:**
- Upgrade Render PostgreSQL plan
- Enable connection pooling (PgBouncer)

**Redis:**
- Upgrade to higher memory tier
- Use Upstash for better scaling

### Vertical Scaling (Better performance)

- Upgrade service plans
- Enable Render auto-scaling
- Optimize database indexes

---

## Troubleshooting

### Issue: Workers not processing

**Check:**
```bash
# View worker logs
render logs -s aura-workers

# Check Redis connection
redis-cli -u [REDIS_URL] ping
```

**Fix:**
- Verify Redis URL in environment
- Restart worker service

### Issue: WebSocket not connecting

**Check:**
- Frontend using `wss://` (not `ws://`) for production
- CORS settings in backend allow frontend domain

**Fix:**
```python
# backend/app/main.py
ALLOWED_ORIGINS = ["https://your-frontend-domain.com"]
```

### Issue: Database connection errors

**Check:**
```bash
# Test connection
psql [DATABASE_URL]
```

**Fix:**
- Verify DATABASE_URL format
- Check database is running
- Increase connection pool size

### Issue: AI commands not working

**Check:**
- Gemini API key is valid
- Check LLM worker logs
- Verify context is being built

**Fix:**
- Test API key manually
- Check quota limits
- Restart workers

---

## Performance Optimization

### Database
```sql
-- Add indexes for common queries
CREATE INDEX idx_transcripts_session_timestamp 
ON transcripts(session_id, timestamp);

CREATE INDEX idx_whiteboard_session_timestamp 
ON whiteboard_logs(session_id, timestamp);
```

### Redis
- Use Redis pipeline for bulk operations
- Set appropriate key expiration times
- Monitor memory usage

### Frontend
- Enable Next.js image optimization
- Use code splitting
- Lazy load heavy components

---

## Security Checklist

- [ ] Change JWT_SECRET from default
- [ ] Use HTTPS for all connections
- [ ] Enable Render IP restrictions
- [ ] Set up database backups
- [ ] Configure CORS properly
- [ ] Use environment variables (never commit secrets)
- [ ] Enable Render SSL certificates
- [ ] Set up rate limiting in production

---

## Cost Estimate

### Free Tier
- Frontend: $0 (Vercel/Render)
- Backend: $0 (with sleep)
- Database: $0 (90-day trial)
- Redis: $0 (25MB)
- R2 Storage: $0 (under 10GB)
- **Whisper API:** ~$180/month (500 hours @ $0.36/hour)
- **Gemini:** $0 (free tier)

**Total: ~$180/month**

### Recommended Tier (No sleep)
- Frontend: $0
- Backend: $7/month
- Workers: $7/month
- Database: $7/month
- Redis: $0
- R2: $0
- Whisper: $180/month
- Gemini: $0

**Total: ~$201/month**

### Scale Tier (100 teachers)
- Frontend: $0
- Backend: $25/month (scaled)
- Workers: $25/month (multiple instances)
- Database: $25/month
- Redis: $10/month
- R2: $0-5/month
- Whisper: $360/month (1000 hours)
- Gemini: $0-50/month

**Total: ~$500/month**

---

## Maintenance

### Weekly
- Check error logs
- Monitor API usage
- Review performance metrics

### Monthly
- Update dependencies
- Review database size
- Optimize slow queries
- Check storage usage

### Quarterly
- Security audit
- Cost optimization review
- Feature backlog prioritization

---

## Backup & Recovery

### Database Backup (Automated on Render)
- Daily automatic backups
- 7-day retention (free tier)
- Manual backup: Dashboard → Database → Backups

### Manual Backup
```bash
# Dump database
pg_dump [DATABASE_URL] > backup.sql

# Restore
psql [DATABASE_URL] < backup.sql
```

### Disaster Recovery
1. Deploy new backend from Git
2. Restore database from backup
3. Update frontend API URL
4. Restart workers

---

## Support

- **Documentation:** README.md, DEVELOPMENT.md
- **Issues:** GitHub Issues
- **Community:** [Your Discord/Slack]

**Built with ❤️ for educators**
