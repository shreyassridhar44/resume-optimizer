# Resume Optimizer

AI-powered resume optimization tool with ATS analysis, real-time editing, and automated tailoring.

---

## 🚀 Quick Deploy

**Deploy in 15 minutes:** See [DEPLOY.md](DEPLOY.md)

**Already deployed but broken?** Your old deployment needs environment variables updated. Follow [DEPLOY.md](DEPLOY.md) from scratch.

---

## 🏠 Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- Git

### Setup

```bash
# Clone repository
git clone <repository-url>
cd resume-optimizer

# Backend setup
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys

# Frontend setup
cd ../frontend
npm install
cp .env.example .env
# Edit .env with backend URL

# Run backend
cd ../backend
uvicorn main:app --reload

# Run frontend (new terminal)
cd ../frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Architecture

```
├── backend/          FastAPI application (Python 3.11)
│   ├── core/        Auth, security, config
│   ├── models/      Pydantic schemas
│   ├── routers/     API endpoints
│   ├── services/    Business logic
│   └── render.yaml  Render deployment config
├── frontend/         React + Vite application (Node 20)
│   └── src/         Components, services, utils
├── docs/            Documentation
└── vercel.json      Vercel deployment config
```

## Documentation

- [Authentication](docs/AUTHENTICATION_EXPLAINED.md)
- [Input Validation](docs/INPUT_VALIDATION.md)
- [Security Summary](docs/SECURITY_SUMMARY.md)
- [Rate Limiting](docs/GROQ_API_RATE_LIMITING.md)
- [Quick Reference](docs/QUICK_REFERENCE.md)

## Features

- **ATS Analysis:** Score resumes against job descriptions
- **Real-time Editor:** Live resume editing with preview
- **Auto Optimization:** AI-powered resume tailoring
- **Version History:** Track resume changes over time
- **Secure Authentication:** JWT-based auth with Supabase

## Tech Stack

**Backend:**
- FastAPI (Python 3.11)
- Supabase (Database & Storage)
- Groq API (LLM)
- Deployed on Render

**Frontend:**
- React 18
- TypeScript
- Vite
- TailwindCSS
- Supabase Client
- Deployed on Vercel

## License

MIT
