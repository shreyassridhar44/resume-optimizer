<div align="center">

<h1>ResumeIQ — Dynamic Resume Optimizer</h1>

<p><strong>An AI-powered, full-stack web application that helps job seekers analyze, optimize, and tailor their resumes to any job description.</strong></p>

<p>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036?style=flat-square" />
</p>

<p>
  <a href="#-project-overview">Overview</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-getting-started">Getting Started</a> ·
  <a href="#-api-reference">API Reference</a> ·
  <a href="#-how-it-works">How It Works</a> ·
  <a href="#-database-schema">Database</a> ·
  <a href="#-deployment">Deployment</a>
</p>

</div>

---

## 📌 Project Overview

Modern hiring pipelines rely heavily on Applicant Tracking Systems (ATS) that automatically filter resumes before a human recruiter ever reviews them. A well-qualified candidate can be rejected simply because their resume does not align with the language and keywords of the job description.

**ResumeIQ** addresses this problem by providing a comprehensive, AI-driven resume analysis platform. The system combines a deterministic keyword-matching ATS engine with a suite of large language model (LLM) analyses to give candidates a complete picture of how their resume performs against a specific role — and exactly what to do to improve it.

The project is developed as a **full-stack web application** with a decoupled architecture:

- A **React + TypeScript** single-page application (SPA) serves as the frontend.
- A **FastAPI (Python)** REST API handles all backend logic, file processing, and AI orchestration.
- **Supabase** provides managed PostgreSQL, user authentication, and file storage.
- The **Groq LLM API** (Llama 3.3 70B) powers all AI-driven features.

---

## ✨ Features

### Core Platform

| Feature | Description |
|---------|-------------|
| **User Authentication** | Email/password and Google OAuth via Supabase Auth. All data is protected by Row-Level Security. |
| **Resume Upload** | Drag-and-drop upload of PDF and DOCX files (up to 10 MB). Text is extracted and parsed server-side. |
| **ATS Keyword Matching** | Tokenizes and normalizes both the resume and job description, removes stopwords, and computes a keyword-match score with matched and missing keyword lists. |
| **AI Bullet-Point Rewriting** | Identifies weak bullet points and rewrites them with strong action verbs and measurable outcomes. |
| **Analysis History** | Every analysis is persisted and viewable in a history page with score trend tracking. |
| **PDF Report Export** | Generates a print-ready PDF report of any analysis. |

### AI-Powered Features (v2)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Recruiter Persona Simulation** | Evaluates the resume through four distinct hiring lenses — **Standard, FAANG, Startup, and HR** — each applying different priorities and scoring strictness. Returns a score out of 10, strengths, weaknesses, and actionable suggestions. |
| 2 | **Auto Cover Letter Generator** | Generates a tailored, one-page cover letter grounded strictly in the candidate's actual resume and the target job description. Supports three tones: Professional, Enthusiastic, and Concise. The output is editable, copyable, and downloadable. |
| 3 | **JD Intelligence Extractor** | Automatically parses a job description into structured intelligence: role summary, required skills, nice-to-have skills, experience level, key responsibilities, and education requirements. Runs concurrently with other analyses. |
| 4 | **Skill Gap Roadmap Generator** | Compares the resume against the role's requirements and produces a readiness score, a list of matched skills, and — for each missing skill — a priority level, the reason it matters for the role, an ordered learning path, and a time estimate. |
| 5 | **Resume Strength Breakdown** | Scores the resume across six independent dimensions: skill match, experience relevance, project depth, keyword coverage, impact, and structure. Each dimension includes a one-line rationale and an overall score computed as the mean. |
| 6 | **Real-Time Live Editor** | A dedicated editor where the score updates instantly as the user types, powered by a fast, **LLM-free** heuristic engine. Input is debounced and in-flight requests are cancelled to prevent race conditions. |

---

## 🏗 Architecture

```
resume-optimizer/
│
├── frontend/                          # React + TypeScript + Tailwind CSS (Vite)
│   └── src/
│       ├── components/
│       │   ├── auth/                  # LandingPage, AuthPage
│       │   ├── dashboard/             # DashboardLayout (sidebar navigation)
│       │   ├── upload/                # UploadPage (file drop, JD input, role & persona selectors)
│       │   ├── results/               # ResultsPage
│       │   │   ├── JDIntelligenceCard.tsx
│       │   │   ├── StrengthBreakdownCard.tsx
│       │   │   ├── SkillGapCard.tsx
│       │   │   └── CoverLetterCard.tsx
│       │   ├── editor/                # LiveEditorPage (real-time scoring)
│       │   ├── history/               # HistoryPage
│       │   └── ui/                    # ScoreRing, ResumePreview
│       ├── hooks/
│       │   └── useAuth.tsx            # Supabase Auth context
│       ├── services/
│       │   ├── api.ts                 # Typed HTTP client for all backend endpoints
│       │   └── pdfExport.ts           # Client-side PDF report generation
│       ├── lib/
│       │   └── supabase.ts            # Supabase client initialisation
│       └── types/
│           └── index.ts               # Shared TypeScript interfaces
│
├── backend/                           # FastAPI (Python 3.11+)
│   ├── main.py                        # Application entry point, CORS middleware
│   ├── core/
│   │   ├── config.py                  # Pydantic settings loaded from .env
│   │   └── supabase.py                # Supabase service-role client
│   ├── models/
│   │   └── schemas.py                 # All Pydantic request/response models
│   ├── routers/
│   │   ├── resume.py                  # POST /api/upload-resume
│   │   ├── analysis.py                # /api/analyze, /rewrite, /cover-letter,
│   │   │                              #   /skill-gap, /live-feedback, /analysis/{id}
│   │   └── history.py                 # GET /api/history, DELETE /api/history/{id}
│   └── services/
│       ├── parser.py                  # PDF/DOCX text extraction and section parsing
│       ├── ats_engine.py              # ATS keyword scoring + live-feedback heuristics
│       ├── llm_service.py             # Groq LLM: all AI feature functions (Llama 3.3 70B)
│       └── storage.py                 # Supabase database operations
│
├── supabase_schema.sql                # Full database schema, migrations, and RLS policies
├── ResumeIQ_Project_Report.docx       # Project report (BMSCE Full Stack Development course)
└── README.md
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript 5.6, Vite | Component-based SPA with type safety and fast builds |
| **Styling** | Tailwind CSS | Utility-first responsive design |
| **Routing** | React Router v6 | Client-side navigation |
| **Backend** | FastAPI, Uvicorn | Async REST API with automatic OpenAPI docs |
| **Data Validation** | Pydantic v2 | Request/response schema enforcement |
| **File Parsing** | pdfplumber, python-docx | PDF and DOCX text extraction |
| **Database & Auth** | Supabase (PostgreSQL) | Managed DB, Auth, Storage, Row-Level Security |
| **AI / LLM** | Groq API — Llama 3.3 70B | All AI-driven analyses |
| **Frontend Deploy** | Vercel | Static SPA hosting |
| **Backend Deploy** | Render | Python web service hosting |

---

## 🚀 Getting Started

This section covers everything needed to clone the repository and run the project locally from scratch.

### Prerequisites

Ensure the following are installed on the development machine:

| Requirement | Version | Notes |
|-------------|---------|-------|
| Git | Any | For cloning the repository |
| Node.js | 18+ | Includes npm |
| Python | 3.11+ | For the backend |
| pip | Latest | Python package manager |

External services required:

| Service | Purpose | Sign-up |
|---------|---------|---------|
| Supabase | Database, Auth, File Storage | [supabase.com](https://supabase.com) — free tier available |
| Groq | LLM API (Llama 3.3 70B) | [console.groq.com](https://console.groq.com) — free tier available |

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/<your-org>/resume-optimizer.git
cd resume-optimizer
```

---

### Step 2 — Configure Supabase

1. Create a new project at [supabase.com](https://supabase.com).

2. In the Supabase dashboard, navigate to **SQL Editor** and run the entire contents of `supabase_schema.sql`. This creates all tables, JSONB columns, indexes, and Row-Level Security policies.

3. Navigate to **Storage** and create a new bucket named exactly `resumes`. Set the bucket to **private**.

4. *(Optional)* To enable Google OAuth, go to **Authentication → Providers → Google** and follow the configuration steps.

5. Collect the following values from **Project Settings → API**:
   - **Project URL** (e.g. `https://xxxxxxxxxxxx.supabase.co`)
   - **anon / public key**
   - **service_role / secret key**

---

### Step 3 — Backend Setup

```bash
cd backend
```

**Create and activate a virtual environment:**

```bash
# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

# Windows (Command Prompt)
python -m venv .venv
.venv\Scripts\activate

# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**Install dependencies:**

```bash
pip install -r requirements.txt
```

**Create the environment file:**

```bash
# macOS / Linux
cp .env.example .env

# Windows
copy .env.example .env
```

**Edit `backend/.env` and fill in all values:**

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_BUCKET=resumes
GROQ_API_KEY=your-groq-api-key
ALLOWED_ORIGINS=["http://localhost:5173"]
MAX_FILE_SIZE_MB=10
```

> ⚠️ **Security:** `SUPABASE_SERVICE_KEY` is a privileged key. It must never be committed to version control or exposed to the browser. The `.gitignore` already excludes `.env`.

**Start the backend development server:**

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive Swagger documentation is available at `http://localhost:8000/docs`.

---

### Step 4 — Frontend Setup

Open a new terminal window.

```bash
cd frontend
```

**Install dependencies:**

```bash
npm install
```

**Create the environment file:**

```bash
# macOS / Linux
cp .env.example .env

# Windows
copy .env.example .env
```

**Edit `frontend/.env` and fill in all values:**

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_API_URL=http://localhost:8000/api
```

> The frontend uses only the **anon key**, which is safe to expose in the browser. Never use the service role key here.

**Start the frontend development server:**

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---

### Step 5 — Verify the Setup

With both servers running, open `http://localhost:5173` in a browser. The expected flow:

1. The landing page loads.
2. Sign up or sign in (email/password or Google OAuth).
3. Upload a PDF or DOCX resume.
4. Paste a job description and select a role type and recruiter persona.
5. Click **Analyze Resume** — the full analysis pipeline runs and results are displayed.
6. Navigate to **Live Editor** in the sidebar to test real-time scoring.

To verify the backend independently, visit `http://localhost:8000/docs` for the interactive API documentation.

---

## 📡 API Reference

All endpoints are prefixed with `/api`. The backend runs on `http://localhost:8000` by default.

### Resume

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/upload-resume` | User ID (form field) | Upload a PDF or DOCX file. Extracts and stores the text. Returns `resume_id`, `file_url`, and a text preview. |

### Analysis

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/analyze` | `user_id` in body | Full analysis pipeline: ATS scoring, recruiter simulation (with persona), JD intelligence extraction, strength breakdown, and bullet rewriting — all run concurrently. |
| `POST` | `/rewrite` | None | Standalone bullet-point rewriter. Accepts a list of bullet strings and an optional job context. |
| `POST` | `/cover-letter` | `user_id` in body | Generates a tailored cover letter from a stored analysis. Accepts `analysis_id`, `tone`, and optional name/company/role fields. |
| `POST` | `/skill-gap` | `user_id` in body | Generates a skill-gap learning roadmap from a stored analysis. Reuses the stored JD intelligence as the requirement checklist. |
| `POST` | `/live-feedback` | None | Instant, LLM-free scoring for the live editor. Accepts `resume_text` and optional `job_description`. Safe to call on every keystroke. |
| `GET` | `/analysis/{analysis_id}` | `user_id` query param | Fetches a specific analysis by ID, including persisted persona, JD intelligence, and strength breakdown. |

### History

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/history` | `user_id` query param | Returns the user's analysis history (up to 100 items). |
| `DELETE` | `/history/{analysis_id}` | `user_id` query param | Deletes an analysis and its associated feedback. |

### Request / Response Examples

**`POST /api/analyze`**
```json
{
  "resume_id": "uuid",
  "job_description": "Full JD text...",
  "user_id": "uuid",
  "role_type": "sde",
  "persona": "faang"
}
```

**`POST /api/cover-letter`**
```json
{
  "analysis_id": "uuid",
  "user_id": "uuid",
  "tone": "professional",
  "applicant_name": "Jane Doe",
  "company_name": "Acme Corp",
  "role_title": "Senior Software Engineer"
}
```

**`POST /api/live-feedback`**
```json
{
  "resume_text": "Resume content...",
  "job_description": "Optional JD text..."
}
```

---

## 🧠 How It Works

### ATS Keyword Matching Engine

The ATS engine (`ats_engine.py`) is a pure-Python, LLM-free component:

1. Both the resume and the job description are tokenized and normalized (lowercased, punctuation stripped).
2. Common English stopwords are removed.
3. Single tokens and bigrams are extracted to capture compound technical terms (e.g. "machine learning", "react native").
4. The score is computed as: `score = (matched_keywords / total_jd_keywords) × 100`.
5. Matched and missing keyword lists are returned alongside the score.

### AI Analysis Pipeline (`/analyze` endpoint)

The `/analyze` endpoint runs four independent operations **concurrently** using Python's `asyncio.gather`:

```
asyncio.gather(
    compute_ats_score(resume, jd),          # pure Python — instant
    simulate_recruiter(resume, jd, persona), # Groq LLM call
    extract_jd_intelligence(jd),             # Groq LLM call
    analyze_strength_breakdown(resume, jd),  # Groq LLM call
)
```

Total latency is bounded by the slowest single call, not the sum of all calls. Bullet rewriting runs after, using the parsed resume sections.

### Recruiter Persona System

Each persona injects a distinct system context into the LLM prompt:

| Persona | Priorities | Scoring Behaviour |
|---------|-----------|-------------------|
| **Standard** | Balanced: relevance, impact, clarity | Moderate |
| **FAANG** | Scale, system design, algorithmic depth, quantified impact | Conservative (high bar) |
| **Startup** | Ownership, shipping speed, versatility, end-to-end delivery | Rewards breadth |
| **HR** | Communication, culture fit, clarity, career progression | Non-technical lens |

The same resume will receive genuinely different scores and feedback depending on the selected persona.

### LLM Response Handling

All LLM responses go through a robust extraction pipeline:

1. Markdown code fences are stripped.
2. A JSON object is isolated from the response text using regex.
3. The parsed object is validated against a strict Pydantic model.
4. If parsing fails, a safe, pre-defined fallback is returned — no request ever crashes due to a malformed LLM response.

### Live Feedback Engine (LLM-Free)

The live editor (`/live-feedback`) uses local heuristics only, making it safe to call on every keystroke:

- **ATS score**: reuses the keyword-matching engine if a JD is provided.
- **Impact score**: measures the ratio of quantified bullets (%, $, numbers, multipliers) and action-verb usage; detects weak phrases like "responsible for".
- **Structure score**: evaluates word count, bullet usage, and presence of standard resume sections.
- **Overall score**: weighted blend (ATS 45% / Impact 30% / Structure 25% when a JD is present).

On the frontend, input is debounced at 500 ms and each new request cancels the previous in-flight one via `AbortController`.

---

## 🗄 Database Schema

The database is managed through Supabase (PostgreSQL). The full schema is defined in `supabase_schema.sql`.

### Tables

| Table | Description |
|-------|-------------|
| `resumes` | Stores resume metadata and extracted text. Foreign key to `auth.users`. |
| `job_descriptions` | Stores the full job description text per analysis. |
| `analyses` | Links a resume to a job description; stores ATS and recruiter scores. |
| `feedback` | Stores all AI output (keywords, suggestions, rewrites, persona, JD intelligence, strength breakdown) as JSONB. |

### Row-Level Security

All four tables have RLS enabled. Users can only read, insert, update, or delete their own rows. The backend uses the service role key to bypass RLS for server-side operations; the frontend never has access to this key.

### Database Migrations

If upgrading an existing database (i.e., the project was set up before the v2 features were added), run the following additive migrations in the Supabase SQL Editor:

```sql
-- These are idempotent and safe to run on any existing database.
alter table public.feedback add column if not exists persona text default 'standard';
alter table public.feedback add column if not exists jd_intelligence jsonb default '{}'::jsonb;
alter table public.feedback add column if not exists strength_breakdown jsonb default '{}'::jsonb;
```

These statements are also included at the bottom of `supabase_schema.sql`.

---

## 🚢 Deployment

### Frontend → Vercel

1. Push the repository to GitHub.
2. Import the project in [vercel.com](https://vercel.com) and set the **root directory** to `frontend`.
3. Set the following environment variables in the Vercel project settings:

```
VITE_SUPABASE_URL       = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY  = your-anon-key
VITE_API_URL            = https://your-backend.onrender.com/api
```

4. Vercel will automatically run `npm run build` (which executes `tsc && vite build`) on every push.

### Backend → Render

1. Create a new **Web Service** in [render.com](https://render.com) and connect the repository.
2. Set the **root directory** to `backend`.
3. Set the **start command** to:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

4. Set the following environment variables in the Render service settings:

```
SUPABASE_URL        = https://your-project.supabase.co
SUPABASE_SERVICE_KEY = your-service-role-key
GROQ_API_KEY        = your-groq-api-key
SUPABASE_BUCKET     = resumes
ALLOWED_ORIGINS     = ["https://your-app.vercel.app"]
MAX_FILE_SIZE_MB    = 10
```

> After deploying the backend, update `VITE_API_URL` in the Vercel frontend settings to point to the Render service URL.

---

## 🔐 Security

| Concern | Mitigation |
|---------|-----------|
| Secret key exposure | `SUPABASE_SERVICE_KEY` and `GROQ_API_KEY` are server-side only; never sent to the browser |
| User data isolation | Row-Level Security on all tables; users access only their own data |
| File storage isolation | Resume files are stored under per-user path prefixes |
| Input validation | All request bodies are validated by Pydantic before processing |
| LLM output safety | All LLM responses are parsed and validated; malformed output triggers a safe fallback |
| Credentials in version control | `.env` files are excluded by `.gitignore` |

---

## 📁 Environment Variable Reference

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key (privileged — server only) |
| `SUPABASE_BUCKET` | ✅ | Storage bucket name (default: `resumes`) |
| `GROQ_API_KEY` | ✅ | Groq API key for LLM access |
| `ALLOWED_ORIGINS` | ✅ | JSON array of allowed CORS origins |
| `MAX_FILE_SIZE_MB` | ❌ | Maximum upload size in MB (default: `10`) |

### `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key (safe for browser) |
| `VITE_API_URL` | ✅ | Backend API base URL (e.g. `http://localhost:8000/api`) |

---


## 📚 Documentation

Additional documentation files are available in the [`docs/`](./docs) directory:

| Document | Description |
|----------|-------------|
| **[Quick Reference Guide](./docs/QUICK_REFERENCE.md)** | Quick setup commands, rate limits, key file locations, troubleshooting tips, and common tasks for development and deployment |
| **[Security & Logging Guide](./docs/SECURITY_AND_LOGGING.md)** | Comprehensive overview of security features (rate limiting, throttling, input validation), structured logging system, error handling, and production deployment checklist |
| **[Groq API & Rate Limiting](./docs/GROQ_API_RATE_LIMITING.md)** | Complete guide to Groq LLM integration, rate limiting implementation, throttling system, how they work together, monitoring metrics, and troubleshooting |
| **[Authentication Audit](./docs/AUTHENTICATION_AUDIT.md)** | ⚠️ **CRITICAL** - Security audit revealing authentication and authorization vulnerabilities that must be fixed before production |
| **[Auth Implementation Guide](./docs/AUTH_IMPLEMENTATION_GUIDE.md)** | Step-by-step guide to implement proper JWT-based authentication and authorization (partially completed, needs router integration) |

### ⚠️ Security Notice

**IMPORTANT**: The application currently has authentication implemented on the frontend but NOT properly enforced on the backend. Review the [Authentication Audit](./docs/AUTHENTICATION_AUDIT.md) and follow the [Implementation Guide](./docs/AUTH_IMPLEMENTATION_GUIDE.md) before deploying to production.

These guides complement the main README by providing operational details for developers and system administrators.

---

## 📄 License

This project is developed for academic purposes as part of the Full Stack Development course at BMSCE. All rights reserved by the respective team members.

---

<div align="center">
  <sub>Built with React · FastAPI · Supabase · Groq</sub>
</div>
