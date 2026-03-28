# Arcadia

Arcadia is a full-stack AI study platform with a FastAPI backend and a React + TypeScript frontend.
It helps learners upload notes, chat with AI over their material, generate quizzes/study aids, plan revision, and track progress.

## Table of Contents

1. [What Arcadia Does](#what-arcadia-does)
2. [Product Gallery](#product-gallery)
3. [Key Features](#key-features)
4. [Architecture](#architecture)
5. [Tech Stack](#tech-stack)
6. [Repository Structure](#repository-structure)
7. [Getting Started](#getting-started)
8. [Configuration](#configuration)
9. [Azure Mode (GPT-5.4-mini)](#azure-mode-gpt-54-mini)
10. [API Surface](#api-surface)
11. [Deployment](#deployment)
12. [Quality Checks](#quality-checks)
13. [Troubleshooting](#troubleshooting)
14. [Roadmap](#roadmap)

## What Arcadia Does

Arcadia is designed for the full study loop:

- Ingest notes from PDFs/images/text
- Convert notes into searchable chunks
- Run contextual AI chat (RAG)
- Generate quizzes, flashcards, cheatsheets, and diagrams
- Build study plans and revision schedules
- Track mastery, streaks, and activity
- Support multilingual translation and text-to-speech

## Product Gallery

Add your own app screenshots/gifs in this section. Recommended folder: `assets/screenshots/`.

Example placeholders:

```md
![Dashboard](assets/screenshots/dashboard.png)
![Chat Experience](assets/screenshots/chat.png)
![Quiz Flow](assets/screenshots/quiz.png)
![Planner](assets/screenshots/planner.png)
```

Project flowchart assets already included:

- ![System Architecture](assets/flowcharts/01_System_Architecture.png)
- ![Data Flow](assets/flowcharts/02_Data_Flow.png)
- ![Quiz Engine](assets/flowcharts/03_Quiz_Engine.png)
- ![RAG Pipeline](assets/flowcharts/04_RAG_Pipeline.png)
- ![Multilingual Flow](assets/flowcharts/05_Multilingual.png)
- ![TTS Flow](assets/flowcharts/06_TTS_Flow.png)
- ![DB Schema](assets/flowcharts/07_DB_Schema.png)
- ![Progress Reset](assets/flowcharts/08_Progress_Reset.png)
- ![User Journey](assets/flowcharts/09_User_Journey.png)

## Key Features

### Notes and Knowledge Layer

- File upload for `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.tiff`, `.txt`
- OCR for images/scanned docs
- Logical note grouping (`note_id`) across multiple files
- Topic extraction and summary caching
- Pin/star and edit support for documents and notes

### AI Learning Workflows

- RAG-powered chat over uploaded notes
- Quiz generation and scoring with history
- Flashcard, cheatsheet, and Mermaid diagram generation
- Streaming chat endpoint (`/api/chat/stream`)

### Planning, Collaboration, and Tools

- Study planner and task lifecycle
- Challenge rooms with leaderboards
- Browser-based multi-language code runner
- Whiteboard hint generation
- Dashboard mastery analytics
- Multilingual translation + TTS
- Galaxy streak visualization

## Architecture

### High-Level

- Frontend calls backend API (`/api/*`)
- Backend handles auth, notes, generation, quizzes, planning, and analytics
- RAG service handles chunking, embeddings, and retrieval
- LLM service routes requests to:
  - Local mode: Ollama
  - Azure mode: Azure OpenAI

### Data Model Pattern

Arcadia uses a logical-note model:

- Each uploaded file is a `Document`
- Related files share one `note_id`
- Note metadata lives in `Note`

This allows multi-file context for chat/quiz/generation without physically merging files.

## Tech Stack

### Frontend

- React 19 + TypeScript + Vite
- TanStack Router + TanStack Query
- Zustand state management
- Tailwind CSS + Radix UI
- Axios, Mermaid, Recharts, Tesseract.js

### Backend

- FastAPI + SQLAlchemy
- SQLite (local) / PostgreSQL + pgvector (recommended production)
- httpx for model/API calls
- PyPDF2 + pdf2image + pytesseract for extraction/OCR

## Repository Structure

```text
Arcadia/
  backend/
    config.py
    main.py
    models/
    routers/
    services/
  frontend/
    src/
      components/
      pages/
      services/
      store/
  assets/
    flowcharts/
  README.md
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- Optional for local OCR: `tesseract` + `poppler`

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

Backend runs on `http://localhost:8000`.

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env
npx vite --port 5173
```

Frontend runs on `http://localhost:5173`.

## Configuration

Backend env lives in `backend/.env`.

Core keys:

```bash
ARCADIA_MODE=local
DATABASE_URL=sqlite:///... # or postgres URL in production
CORS_ALLOWED_ORIGINS=http://localhost:5173
AUTH_FRONTEND_URL=http://localhost:5173
```

Rate-limits and payload guards are configurable (see `backend/.env.example`).

Frontend env:

```bash
VITE_API_BASE_URL=http://localhost:8000/api
```

## Azure Mode (GPT-5.4-mini)

Arcadia now defaults Azure chat deployment to `gpt-5.4-mini`.

### Required Azure vars

```bash
ARCADIA_MODE=azure

AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_REASONING_EFFORT=medium

AZURE_FORM_RECOGNIZER_ENDPOINT=https://<resource>.cognitiveservices.azure.com
AZURE_FORM_RECOGNIZER_KEY=<key>

AZURE_SPEECH_KEY=<key>
AZURE_SPEECH_REGION=<region>

AZURE_TRANSLATOR_KEY=<key>
AZURE_TRANSLATOR_REGION=<region>
```

### Compatibility behavior implemented

For reasoning-style deployments (`gpt-5*`, `o1*`, `o3*`, `o4*`), Arcadia now sends:

- `max_completion_tokens` (instead of `max_tokens`)
- optional `reasoning_effort`

For non-reasoning deployments, Arcadia continues using:

- `max_tokens`
- `temperature`

This is applied consistently across:

- `LLMService` text generation and stream generation
- OCR cleanup calls
- Azure embeddings now use centralized API version config

### Validation checklist

1. Start backend with `ARCADIA_MODE=azure`.
2. Check `GET /` and confirm `"mode": "azure"`.
3. Check `GET /api/health/azure` and confirm `configured: true`.
4. Upload an image/PDF and verify OCR + chat both work.

## API Surface

All backend routes are mounted under `/api`.

### Auth

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-otp`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/oauth/{provider}/start`
- `GET /api/auth/oauth/{provider}/callback`

### Notes and Documents

- `POST /api/upload`
- `GET /api/documents`
- `GET /api/notes`
- `GET /api/documents/pinned`
- `PATCH /api/documents/{doc_id}`
- `PATCH /api/notes/{note_id}`
- `PATCH /api/documents/{doc_id}/star`
- `PATCH /api/notes/{note_id}/star`
- `GET /api/documents/{doc_id}`
- `DELETE /api/documents/{doc_id}`
- `POST /api/documents/{doc_id}/topics`

### Chat and Generation

- `POST /api/chat`
- `POST /api/chat/stream`
- `GET /api/chat/history/{document_id}`
- `DELETE /api/chat/history/{document_id}`
- `GET /api/generate/stored/{document_id}`
- `POST /api/generate/cheatsheet`
- `POST /api/generate/flashcards`
- `POST /api/generate/diagram`

### Quiz and Dashboard

- `POST /api/quiz/generate`
- `POST /api/quiz/submit`
- `GET /api/quiz/history`
- `GET /api/dashboard/stats`
- `GET /api/dashboard/mastery`
- `GET /api/dashboard/recent-quizzes`
- `DELETE /api/dashboard/reset`

### Planner and Calendar

- `POST /api/planner/create`
- `POST /api/planner/tasks/custom`
- `GET /api/planner/tasks`
- `POST /api/planner/tasks/{task_id}/complete`
- `DELETE /api/planner/tasks`
- `GET /api/calendar/google/url`
- `GET /api/calendar/google/start`
- `GET /api/calendar/google/callback`
- `GET /api/calendar/google/status`
- `POST /api/calendar/google/push`

### Other

- `POST /api/challenge/create`
- `POST /api/challenge/join`
- `POST /api/challenge/{code}/start`
- `GET /api/challenge/{code}`
- `POST /api/challenge/{code}/submit`
- `GET /api/challenge/{code}/leaderboard`
- `POST /api/code/run`
- `POST /api/whiteboard/hint`
- `POST /api/translate`
- `POST /api/tts`
- `GET /api/languages`
- `GET /api/user/streak`
- `GET /api/health/azure`

## Deployment

### Recommended

- Frontend: Vercel (root `frontend/`)
- Backend: Render (uses `backend/Dockerfile`)
- DB: Neon/Supabase PostgreSQL + `pgvector`

### Backend deployment notes

- Set all runtime env vars (`backend/.env.example` is the template)
- Ensure `DATABASE_URL` points to Postgres in production
- Enable `vector` extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Frontend deployment notes

Set:

```bash
VITE_API_BASE_URL=https://<backend-domain>/api
```

## Quality Checks

### Frontend

```bash
cd frontend
npm run typecheck
npm run check
npm run build
```

### Backend

```bash
cd backend
python3 -m compileall .
```

## Troubleshooting

- `422 Text extraction failed`: verify OCR dependencies and input file quality.
- `401/403` in Azure mode: verify endpoint/key/deployment/API version.
- Empty chat answers: ensure upload indexed correctly and context exists.
- CORS issues: set `CORS_ALLOWED_ORIGINS` to exact frontend origin(s).
- Code runner errors: ensure runtimes/tools are available on host image.

## Roadmap

- Add automated tests for key routers/services
- Add migration tooling for DB schema changes
- Add observability stack (centralized logs + tracing)
- Improve production auth/session hardening
- Add richer docs with sequence diagrams and API examples

---

If you want, we can also create a second `README-dev.md` focused only on contributor workflows (code style, branch strategy, testing matrix, and release checklist).
