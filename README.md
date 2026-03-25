# Arcadia

AI-powered multimodal study companion with a **React + Vite + Tailwind frontend** and **FastAPI backend**.

This README is written as a **build contract** for humans and AI agents. It defines:
- what pages exist,
- what each page must do,
- which backend endpoints to call,
- request/response shapes,
- integration rules (auth, proxy, static audio, loading/error UX).
- **Backend service and router coverage:** All backend services, routers, and their responsibilities are documented below for full-stack clarity.
---

## 2a) Backend Services Overview

All backend logic is modularized in `backend/services/`:

- **ocr_service.py**: Extracts text from images and PDFs using Tesseract (local) or Azure Form Recognizer (cloud). Handles image, PDF, and plain text extraction, with Unicode cleaning.
- **rag_service.py**: Handles document chunking, embedding, and retrieval using ChromaDB and sentence-transformers. Provides chunking, indexing, retrieval, and deletion for RAG.
- **llm_service.py**: Unified interface for text generation (Ollama or Azure OpenAI). Handles chat, quiz, cheatsheet, flashcards, diagrams, and prompt building.
- **quiz_service.py**: Adaptive quiz engine with mastery tracking. Generates, scores, and tracks quizzes, updates mastery, and manages weak topics.
- **generate_service.py**: Generates cheatsheets, flashcards, and Mermaid diagrams from document content using LLM and RAG.
- **tts_service.py**: Text-to-speech using gTTS (local) or Azure AI Speech. Returns audio URLs for frontend playback.
- **translate_service.py**: Translation using deep-translator (local) or Azure Translator. Handles chunked translation for long texts.
- **safety_service.py**: Responsible AI guardrails. Blocks harmful/explicit uploads, prompts, and output. Uses Hugging Face NSFW detection for images and regex for text.

All services are singletons and imported by routers as needed.

---

## 2b) Backend Routers Overview

All API endpoints are defined in `backend/routers/`:

- **auth.py**: User registration, login, session management, and current user lookup.
- **upload.py**: File upload, OCR, document CRUD, topic extraction, and ChromaDB indexing.
- **chat.py**: RAG-powered chat, streaming chat (SSE), chat history, and clearing chat.
- **quiz.py**: Quiz generation, submission, and history.
- **generate.py**: Cheatsheet, flashcard, and diagram generation and caching.
- **tts.py**: Text-to-speech and translation endpoints.
- **dashboard.py**: Learning analytics, mastery, recent quizzes, and progress reset.
- **planner.py**: Study plan creation, task management, spaced repetition, and custom tasks.
- **whiteboard.py**: OCR and hint generation for rough work images or typed input.
- **challenge.py**: Multiplayer quiz challenge rooms (create, join, start, submit, leaderboard).

All routers use dependency-injected authentication and database sessions.

---
## 2c) Backend Models and Schemas

All request/response shapes are defined in `backend/models/schemas.py` using Pydantic. This includes:
- Document upload/response, chat request/response, quiz generation/submission/results, cheatsheet/flashcard/diagram generation, TTS/translation, dashboard stats, topic extraction, and more.

Database models (SQLAlchemy) are in `backend/models/database.py` (not shown here).

---
## 2d) Backend Config

All configuration is in `backend/config.py`:
- Switch between "local" and "azure" mode via `ARCADIA_MODE`.
- Paths, embedding models, chunking, quiz thresholds, supported languages, and all Azure/LLM keys are set here.
## 9) Project Structure (Important Paths)

---

## 1) Product Summary

Arcadia helps students learn from their own materials:
- Upload notes (PDF/images/text)
- Ask contextual questions via RAG chat
- Generate adaptive quizzes and track mastery
- Produce cheatsheets, flashcards, and Mermaid diagrams
- Use translation + TTS for multilingual study
- Plan study schedules and challenge friends
- Enforce Responsible AI checks for unsafe/explicit uploads and harmful instructions

---

## 2) Current Tech Stack

- **Frontend:** React 19, Vite 5, Tailwind, TanStack Router, Zustand, Sonner, Axios
- **Backend:** FastAPI, SQLAlchemy, ChromaDB, Ollama/Azure-ready services
- **Data/Assets:** SQLite + local files, static TTS audio at `/static/audio/...`

---

## 3) Frontend Routes (Source of Truth)

Protected routes require auth token in local state/storage.

- `/auth` → `AuthPage`
- `/home` → `HomePage`
- `/dashboard` → `DashboardPage`
- `/notes` → `NotesPage`
- `/chat` → `ChatPage`
- `/quiz` → `QuizPage`
- `/study` → `StudyPage`
- `/planner` → `PlannerPage`
- `/challenge` → `ChallengePage`

Routing is defined in `frontend/src/App.tsx`.

---

## 4) Integration Rules (Must Follow)

### 4.1 Base URLs and Proxy
Frontend dev config:
- Vite proxy `/api` → `http://localhost:8000`
- Vite proxy `/static` → `http://localhost:8000`
- Frontend env: `VITE_API_BASE_URL=http://localhost:8000/api`

Files:
- `frontend/vite.config.js`
- `frontend/.env` (optional)

### 4.2 Authentication
- Login/register returns a `token`
- Token must be sent as `Authorization: Bearer <token>`
- Axios interceptor handles this globally

File:
- `frontend/src/services/api.ts`

### 4.3 Static TTS Audio
Backend mounts static files and returns audio URLs such as:
- `/static/audio/tts_*.mp3`

Backend file:
- `backend/main.py`

### 4.4 Error + Loading UX Standard
For all major API calls:
- wrap in `try/catch`
- show toast on error
- use loading/skeleton states for pending UI

### 4.5 Language + TTS Behavior
- Re-translation: on `currentLanguage` change, iterate all prior assistant messages and call translate endpoint
- TTS race condition: if user plays a second message, stop/reset current audio before starting next

### 4.6 Responsible AI Guardrails
- Unsafe content returns `HTTP 400` with a safety reason (instead of generating output)
- Upload flow blocks:
  - text/ocr content with explicit sexual material
  - harmful instruction content (ex: bomb-making)
  - unsafe images via image moderation classifier
- Chat (`/chat` and `/chat/stream`) blocks unsafe prompts and unsafe generated output
- Study generation (`/generate/*`) and quiz generation (`/quiz/generate`) block unsafe topics/content/output
- Image moderation uses Hugging Face model `Falconsai/nsfw_image_detection`:
  - preferred: API mode via `HUGGINGFACEHUB_API_TOKEN`
  - optional: local mode if `transformers` + runtime backend are available
  - default is fail-closed if image moderation cannot run

---

## 5) Frontend Page Requirements (AI Implementation Contract)

Use this section to generate/validate each page.

### 5.1 AuthPage (`/auth`)
**Purpose:** Login/Register and bootstrap authenticated session.

Required behavior:
- Connect Login form to `POST /api/auth/login`
- Connect Register form to `POST /api/auth/register`
- On success: persist token, set current user, redirect to `/home`
- On failure: show toast + inline error state
- Include loading states for submit buttons

### 5.2 HomePage (`/home`)
**Purpose:** Entry dashboard and feature navigation.

Required behavior:
- Show bento-style shortcuts to major product sections
- Surface current language and quick actions
- No blocking API dependency required to render

### 5.3 DashboardPage (`/dashboard`)
**Purpose:** Learning analytics and progress reset.

Required behavior:
- Fetch and map stats + mastery to bento/grid components
- Primary endpoint: `GET /api/dashboard/stats`
- Secondary endpoints (optional views):
  - `GET /api/dashboard/mastery`
  - `GET /api/dashboard/recent-quizzes`
- Reset action: `DELETE /api/dashboard/reset`
- Show skeleton loaders for stats/mastery sections
- Show confirmation flow for reset + success/error toasts

### 5.4 NotesPage (`/notes`)
**Purpose:** Manage notes + note-scoped assistant chat.

Required behavior:
- Two-panel layout:
  - left: note list CRUD UI
  - right: note editor + contextual chat
- Chat calls `POST /api/chat`
- Assistant messages include TTS play controls
- On language change, retranslate existing assistant messages

### 5.5 ChatPage (`/chat`)
**Purpose:** Full-page AI tutor conversation.

Required behavior:
- Message thread + composer + send action
- Call `POST /api/chat` for replies
- TTS button per assistant message
- Enforce single active audio playback (global audio controller)
- Re-translate visible history when language changes

### 5.6 QuizPage (`/quiz`)
**Purpose:** Adaptive quiz lifecycle.

Required behavior:
1. Config step (tier/difficulty + options)
2. Quiz step (one question at a time, progress)
3. Review step (correct vs selected + explanations)

Endpoints:
- Generate: `POST /api/quiz/generate`
- Submit: `POST /api/quiz/submit`
- Optional history: `GET /api/quiz/history`

Also include:
- skeleton/loading states while generating/submitting
- error toasts
- optional whiteboard hint panel integration (`POST /api/whiteboard/hint`)

### 5.7 StudyPage (`/study`)
**Purpose:** AI-generated study materials.

Required behavior:
- Tabbed UI:
  - Cheatsheet (`POST /api/generate/cheatsheet`)
  - Flashcards (`POST /api/generate/flashcards`)
  - Diagram (`POST /api/generate/diagram`, render Mermaid)
- Allow language-aware generation payload
- TTS on generated text blocks where relevant

### 5.8 PlannerPage (`/planner`)
**Purpose:** Schedule and spaced repetition planning.

Required behavior:
- Create plan: `POST /api/planner/create`
- Fetch tasks and metadata: `GET /api/planner/tasks`
- Complete task: `POST /api/planner/tasks/{task_id}/complete`
- Render calendar/timetable style task visualization
- Show loading/empty/error states

### 5.9 ChallengePage (`/challenge`)
**Purpose:** Multiplayer challenge room flow.

Required behavior:
- Create room: `POST /api/challenge/create`
- Join room: `POST /api/challenge/join`
- Room state: `GET /api/challenge/{code}`
- Start room (host): `POST /api/challenge/{code}/start`
- Submit answers: `POST /api/challenge/{code}/submit`
- Leaderboard: `GET /api/challenge/{code}/leaderboard`
- Display participant statuses and gate start appropriately

---

## 6) API Endpoint Catalog (FastAPI)

> All routes below are under `/api/*` unless noted.
> Most endpoints require `Authorization: Bearer <token>`.

### 6.1 Health
- `GET /` (no `/api` prefix) → service status

### 6.2 Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Auth response shape:
```json
{
  "user_id": "uuid",
  "name": "Jane",
  "email": "jane@example.com",
  "token": "..."
}
```

### 6.3 Upload & Documents
- `POST /upload` (multipart: `file`, `subject`, `topic`)
- `GET /documents`
- `GET /documents/{doc_id}`
- `DELETE /documents/{doc_id}`
- `POST /documents/{doc_id}/topics`

### 6.4 Chat
- `POST /chat`
- `POST /chat/stream` (SSE)
- `GET /chat/history/{document_id}`

`POST /chat` request shape:
```json
{
  "document_id": "uuid-or-empty",
  "document_ids": ["uuid"],
  "topic": "optional-topic",
  "message": "Explain chapter 2",
  "language": "en"
}
```

Response shape:
```json
{
  "answer": "...",
  "sources": ["doc_id_1"],
  "language": "en"
}
```

### 6.5 Quiz
- `POST /quiz/generate`
- `POST /quiz/submit`
- `GET /quiz/history`

Generate request:
```json
{
  "document_id": "uuid",
  "tier": 1,
  "num_questions": 5,
  "language": "en",
  "focus_topic": ""
}
```

Submit request:
```json
{
  "quiz_id": "uuid",
  "document_id": "uuid",
  "answers": [
    { "question_id": 1, "selected_option": 2 }
  ]
}
```

### 6.6 Study Material Generation
- `POST /generate/cheatsheet`
- `POST /generate/flashcards`
- `POST /generate/diagram`

Shared request base:
```json
{
  "document_id": "uuid",
  "language": "en",
  "focus_topic": ""
}
```

### 6.7 TTS + Translation + Languages
- `POST /tts`
- `POST /translate`
- `GET /languages`

TTS response:
```json
{
  "audio_url": "/static/audio/tts_xxx.mp3",
  "language": "en"
}
```

Translate response:
```json
{
  "original_text": "...",
  "translated_text": "...",
  "source_language": "en",
  "target_language": "hi"
}
```

### 6.8 Dashboard
- `GET /dashboard/stats`
- `GET /dashboard/mastery`
- `GET /dashboard/recent-quizzes`
- `DELETE /dashboard/reset`

### 6.9 Planner
- `POST /planner/create`
- `GET /planner/tasks`
- `POST /planner/tasks/{task_id}/complete`

### 6.10 Whiteboard
- `POST /whiteboard/hint`

### 6.11 Challenge Rooms
- `POST /challenge/create`
- `POST /challenge/join`
- `POST /challenge/{code}/start`
- `GET /challenge/{code}`
- `POST /challenge/{code}/submit`
- `GET /challenge/{code}/leaderboard`

---

## 7) Endpoint Mapping for API Client Service

For consistent frontend service naming:

- `auth/login` → `POST /api/auth/login`
- `auth/register` → `POST /api/auth/register`
- `notes/upload` → `POST /api/upload`
- `chat/query` → `POST /api/chat`
- `quiz/generate` → `POST /api/quiz/generate`
- `planner/get` → `GET /api/planner/tasks`
- `languages/list` → `GET /api/languages`

---

## 8) Local Development (npm + Python)

### 8.1 Backend
```bash
cd backend
source arc/bin/activate
pip install -r requirements.txt

# Responsible AI image moderation (recommended)
export HUGGINGFACEHUB_API_TOKEN="<your_hf_token>"

# Optional toggles
# export ARCADIA_IMAGE_MODERATION_ENABLED=true
# export ARCADIA_IMAGE_MODERATION_FAIL_CLOSED=true

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Check:
- `http://localhost:8000/` (health)
- `http://localhost:8000/docs` (Swagger)

### 8.2 Frontend
```bash
cd frontend
npm install
npx vite --host 0.0.0.0 --port 5173
```

Open:
- `http://localhost:5173`

---

## 9) Project Structure (Important Paths)

```text
Arcadia/
├── backend/
│   ├── main.py                # FastAPI app entrypoint
│   ├── config.py              # All config/env vars
│   ├── routers/               # All API endpoints
│   │   ├── auth.py            # Auth endpoints
│   │   ├── upload.py          # File upload, OCR, doc CRUD
│   │   ├── chat.py            # RAG chat, streaming, history
│   │   ├── quiz.py            # Quiz gen/submit/history
│   │   ├── generate.py        # Cheatsheet/flashcard/diagram
│   │   ├── tts.py             # TTS and translation
│   │   ├── dashboard.py       # Analytics, mastery, reset
│   │   ├── planner.py         # Study plan, tasks, spaced rep
│   │   ├── whiteboard.py      # OCR + hint for rough work
│   │   └── challenge.py       # Multiplayer quiz rooms
│   ├── services/              # All backend logic modules
│   │   ├── ocr_service.py     # OCR for images/PDFs
│   │   ├── rag_service.py     # ChromaDB RAG
│   │   ├── llm_service.py     # LLM abstraction
│   │   ├── quiz_service.py    # Quiz engine/mastery
│   │   ├── generate_service.py# Cheatsheet/flashcard/diagram
│   │   ├── tts_service.py     # Text-to-speech
│   │   ├── translate_service.py# Translation
│   │   └── safety_service.py  # Responsible AI guardrails
│   ├── models/
│   │   ├── schemas.py         # Pydantic API schemas
│   │   └── database.py        # SQLAlchemy models (not shown)
│   └── data/                  # Uploaded files, ChromaDB, etc.
│
├── frontend/
│   ├── .env (optional)
│   ├── vite.config.js
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       ├── store/
│       ├── services/api.ts
│       └── ... (see above)
│
└── README.md
```

---

## 10) Notes for AI Code Generation

If you are an AI generating frontend code for Arcadia:
- implement pages based on Section 5 contracts,
- use endpoint catalog in Section 6,
- use service naming in Section 7,
- always include token auth, loading states, and toast-based error handling,
- do not hardcode `http://localhost:8000` in page components; use `api.ts` + Vite proxy.

This README should be treated as the canonical integration spec for React frontend parity with FastAPI backend.

---

## 11) Responsible AI Test Plan (Manual)

Use these checks after starting backend on `localhost:8000`.

### 11.1 Upload block: harmful instructions in document text
1. Create a text file with harmful content (example phrase containing `how to make a bomb`).
2. Upload it using Notes upload UI or `POST /api/upload`.
3. Expected: `HTTP 400` and safety error message.

### 11.2 Upload block: explicit image
1. Upload an image expected to be unsafe (18+ explicit content).
2. Expected: `HTTP 400` and adult/explicit rejection message.
3. If you get "Image moderation is not available right now", set `HUGGINGFACEHUB_API_TOKEN` and retry.

### 11.3 Chat block: harmful user prompt
1. Ask in chat: content requesting weapon/explosive instructions.
2. Expected: request rejected with `HTTP 400` and no answer returned.

### 11.4 Streaming chat block
1. Use chat stream endpoint with a harmful prompt.
2. Expected: early `[ERROR]` SSE event with safety reason, no unsafe content streamed.

### 11.5 Study generation block (`/generate/*`)
1. Trigger cheatsheet/flashcards/diagram generation with harmful `focus_topic`.
2. Expected: `HTTP 400` safety error.

### 11.6 Quiz generation block (`/quiz/generate`)
1. Generate quiz with harmful `focus_topic` or unsafe source doc.
2. Expected: `HTTP 400` safety error.
