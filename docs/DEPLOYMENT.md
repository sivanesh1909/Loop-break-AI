# LoopBreak AI — Deployment Guide

## Production Architecture Overview

LoopBreak AI is designed to be hosted seamlessly across modern cloud infrastructure:

- **Frontend**: Single Page Application (SPA) deployable on **Vercel**, **Netlify**, or **Cloudflare Pages**.
- **Backend**: Containerized ASGI application running FastAPI on **Render**, **Railway**, **Fly.io**, or **AWS ECS/App Runner**.
- **Database**:
  - **Local Development / Demos**: Embedded SQLite (`loopbreak.db`) with WAL mode enabled.
  - **Production**: PostgreSQL (e.g. Supabase, Neon, AWS RDS, or Render PostgreSQL) configured via `DATABASE_URL=postgresql+psycopg2://user:pass@host/dbname`.

---

## 1. Frontend Deployment (Vercel)

### Option A: Vercel CLI
```bash
cd frontend
npm install
npm run build
npx vercel --prod
```

### Option B: Git Push (GitHub / GitLab)
1. Push the repository to GitHub.
2. In Vercel, import the repository and set **Root Directory** to `frontend`.
3. Set the Environment Variable:
   - `VITE_API_URL`: `https://your-backend-api-url.com`
4. Deploy! SPA routing fallbacks are already configured in `vite.config.ts`.

---

## 2. Backend Deployment (Render / Railway)

### Using Docker
A production `Dockerfile` is provided in `backend/Dockerfile`:
```bash
docker build -t loopbreak-api ./backend
docker run -p 8000:8000 --env-file ./backend/.env loopbreak-api
```

### Direct Python Runtime (Render Web Service)
1. Set **Root Directory** to `backend`.
2. **Build Command**: `pip install -r requirements.txt`
3. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables**:
   - `GEMINI_API_KEY`: `<your_google_ai_studio_key>`
   - `GEMINI_MODEL`: `gemini-2.0-flash`
   - `AI_MODE`: `auto` (or `ai`)
   - `DATABASE_URL`: `postgresql://...` (or a persistent volume path for SQLite)
   - `CORS_ORIGINS`: `https://your-frontend.vercel.app`

> **Note on SQLite in Free Hosting Tiers**: Free tiers on Render/Railway utilize ephemeral filesystems. For production persistence across redeploys and restarts, attach a persistent disk volume or configure a PostgreSQL `DATABASE_URL`.

---

## 3. Environment Variables Reference

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `""` | Google AI Studio free-tier API key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model for reasoning |
| `AI_MODE` | `auto` | `auto` (falls back to local demo if no key), `ai`, or `demo` |
| `DATABASE_URL` | `sqlite:///./loopbreak.db` | SQLAlchemy connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed origins |
| `UPLOAD_DIR` | `./uploads` | Stored uploads folder |
| `MAX_UPLOAD_SIZE_MB`| `10` | Maximum upload file limit in MB |
| `USE_EMBEDDINGS` | `false` | Enable local sentence-transformers model |

