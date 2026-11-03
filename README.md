# LoopBreak AI
### *"AI That Learns From What Didn't Work."*

LoopBreak AI is an adaptive, evidence-based troubleshooting platform. Unlike conventional chatbots that suggest generic fixes or loop back to failed recommendations, LoopBreak AI actively tracks previous attempts, calculates semantic and synonym similarity to detect repeats, asks focused diagnostic questions, and generates context-aware next-best actions.

---

## 🌟 Key Features

1. **Semantic Failure Memory**:
   - Tracks failed attempts and their evidence.
   - Detects repeated and synonymous actions (e.g. *"Restart the router"* vs. *"Power cycle your Wi-Fi router"*).
   - Rejects repeats unless supported by fresh evidence.

2. **Adaptive AI Diagnosis**:
   - Integrated with **Google Gemini** (`gemini-2.0-flash` on the free tier).
   - Structured JSON schema enforcement with Pydantic.
   - Distinguishes clearly between *unverified hypotheses*, *probable causes*, and *confirmed root causes*.

3. **Deterministic Local Demo Engine**:
   - Runs out-of-the-box **without an API key**.
   - Includes 5 complete interactive troubleshooting scenarios across network, deployment, python dependencies, mobile apps, and hardware.

4. **Safety & Guardrails**:
   - Automatic pre-screening against physical, medical, electrical, or destructive operations.
   - Professional escalation warnings when user safety is at stake.

5. **Multi-Format Ingestion & PDF Reports**:
   - PDF, TXT, image OCR, and error-log file upload support.
   - Downloadable formatted troubleshooting resolution reports.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+)

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Configure Gemini API Key:
copy .env.example .env
# Edit .env and paste your GEMINI_API_KEY from https://aistudio.google.com/apikey

# Start backend server
uvicorn app.main:app --reload --port 8000
```

The backend API will be running at `http://localhost:8000` (Interactive docs at `/api/docs`).

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend application will be running at `http://localhost:5173`.

---

## 🧪 Testing

Execute the test suites:

```bash
# Backend unit & integration tests
cd backend
pytest tests/ -v
```

---

## 📁 Project Architecture

```
LoopBreak-AI/
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI widgets
│   │   ├── layouts/          # Responsive App & Sidebar navigation
│   │   ├── pages/            # Landing, Dashboard, NewProblem, Diagnose, Result, Sessions, Settings
│   │   ├── services/         # Axios API clients
│   │   ├── types/            # TypeScript data contracts
│   │   ├── utils/            # Formatting, colors, calculations
│   │   ├── App.tsx           # Router configuration
│   │   └── main.tsx          # React application root
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── api/              # REST Routers (sessions, stats, files, demo)
│   │   ├── core/             # Configuration & logging
│   │   ├── database/         # SQLAlchemy connection & initialization
│   │   ├── models/           # DB tables (Session, Attempt, Question, File, RootCause)
│   │   ├── schemas/          # Pydantic request/response validation
│   │   ├── services/         # AI service, Failure memory, Demo engine, Files, PDF reports
│   │   └── main.py           # FastAPI entrypoint
│   ├── tests/                # Automated pytest test suites
│   ├── requirements.txt
│   └── .env.example
│
├── docs/
│   └── DEPLOYMENT.md         # Production deployment instructions (Vercel & Render)
├── .gitignore
└── README.md
```

---

## 🛡️ License
MIT License.

