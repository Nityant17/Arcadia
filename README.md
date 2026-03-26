# Arcadia

Arcadia is a full-stack AI study platform built with a FastAPI backend and React frontend.

- Backend: `backend/`
- Frontend: `frontend/`

It supports note ingestion, AI chat, quiz/study generation, planner scheduling, challenge rooms, code execution, and multilingual support.

## Feature Overview

## Notes and Knowledge
- Upload PDFs/images/text files
- Logical multi-file notes via `note_id` (no physical file merge)
- Note-level editing (title/subject/topic)
- Note-level topic extraction and summary caching
- Note-level pinning/star behavior
- Single persisted summary/topic cache per logical note context

## Learning Flows
- Chat over complete note context
- Quiz generation/submission over note context
- Study materials (cheatsheet/flashcards/diagram) over note context
- Planner with study blocks, topic-scoped spaced repetition, quiz revisions

## Collaboration and Utilities
- Challenge rooms with room codes
- Room URL persistence (`/challenge?room=XXXXXX`)
- Code Lab runner (Python/JS/C/C++/Java)
- Code Lab OCR upload (code files + handwritten images)
- Translation + TTS
- Galaxy streak visualization (daily login stars + constellations)
- Floating Quick Tools accessibility ball (draggable + persistent)

## Galaxy Experience
- Supports all 88 IAU constellations from `frontend/src/constellation_pattern`
- Uses mythological figure overlays from `frontend/src/constellation_outlines` that fade in on completion
- Constellation geometry (star counts and line arrangements) is derived from the pattern references
- Interactive navigation:
  - Mouse wheel zoom
  - Click-drag pan
  - Reset-view control (bottom-right)

## Multi-File Note Data Model

Arcadia uses a **logical grouping** model:
- Each physical file is a row in `documents`
- Related files share a common `documents.note_id`
- The note container metadata is in `notes`

Because the note is logical:
- Chat/Quiz/Study/Topics can be resolved over all docs in that note
- Deleting one file does not break the note if other files remain
- Pinning and note labels are represented at note level in UI

## Architecture

## Frontend
- React 19 + TypeScript + Vite
- TanStack Router
- Zustand state store
- Axios API client
- Tailwind + custom UI components
- Tesseract.js (client-side OCR for Code Lab)

## Backend
- FastAPI routers
- SQLAlchemy + SQLite
- Service layer (`backend/services`) for OCR, RAG, LLM, generation, quiz, translation, TTS, safety

## Backend Service Map

- `ocr_service.py`: OCR / text extraction
- `rag_service.py`: indexing + retrieval
- `llm_service.py`: prompt execution and model calls
- `quiz_service.py`: quiz generation/scoring/mastery
- `generate_service.py`: cheatsheets/flashcards/diagram generation
- `translate_service.py`: translation
- `tts_service.py`: speech synthesis
- `safety_service.py`: text/image safety gates
- `note_service.py`: note/document context resolution

## Backend Routers

- `auth.py`
- `upload.py`
- `chat.py`
- `quiz.py`
- `generate.py`
- `planner.py`
- `challenge.py`
- `whiteboard.py`
- `code_runner.py`
- `dashboard.py`
- `tts.py`
- `user.py`

## Frontend Routes

Defined in `frontend/src/App.tsx`:
- `/auth`
- `/home`
- `/dashboard`
- `/notes`
- `/chat`
- `/quiz`
- `/study`
- `/planner`
- `/challenge`
- `/code`
- `/galaxy`

## API Quick Reference

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

## Notes/Documents
- `POST /api/upload`
- `GET /api/documents`
- `GET /api/notes`
- `PATCH /api/documents/{doc_id}`
- `PATCH /api/notes/{note_id}`
- `PATCH /api/documents/{doc_id}/star`
- `PATCH /api/notes/{note_id}/star`
- `DELETE /api/documents/{doc_id}`
- `POST /api/documents/{doc_id}/topics`

## Chat
- `POST /api/chat`
- `GET /api/chat/history/{context_id}`
- `DELETE /api/chat/history/{context_id}`

## Quiz
- `POST /api/quiz/generate`
- `POST /api/quiz/submit`
- `GET /api/quiz/history`

## Study
- `POST /api/generate/cheatsheet`
- `POST /api/generate/flashcards`
- `POST /api/generate/diagram`
- `GET /api/generate/stored/{document_id}`

## Planner
- `POST /api/planner/create`
- `GET /api/planner/tasks`
- `POST /api/planner/tasks/{task_id}/complete`
- `POST /api/planner/tasks/custom`
- `DELETE /api/planner/tasks`

## Challenge
- `POST /api/challenge/create`
- `POST /api/challenge/join`
- `GET /api/challenge/{code}`
- `POST /api/challenge/{code}/start`
- `POST /api/challenge/{code}/submit`
- `GET /api/challenge/{code}/leaderboard`

## Other
- `POST /api/code/run`
- `POST /api/whiteboard/hint`
- `POST /api/translate`
- `POST /api/tts`
- `GET /api/health/azure`
- `GET /api/user/streak`

## Local Setup

## Prerequisites
- Python 3.10+
- Node.js 18+
- npm

## Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

Production build:
```bash
cd frontend
npm run build
```

## Azure Backend Mode (Production-Ready Path)

Arcadia supports Azure mode via `ARCADIA_MODE=azure`.

Set these environment variables in backend runtime:

```bash
ARCADIA_MODE=azure

AZURE_OPENAI_ENDPOINT=<https://...openai.azure.com>
AZURE_OPENAI_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=<chat_deployment_name>
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=<embedding_deployment_name>

AZURE_FORM_RECOGNIZER_ENDPOINT=<https://...cognitiveservices.azure.com>
AZURE_FORM_RECOGNIZER_KEY=<key>

AZURE_SPEECH_KEY=<key>
AZURE_SPEECH_REGION=<region>

AZURE_TRANSLATOR_KEY=<key>
AZURE_TRANSLATOR_REGION=<region>

AZURE_SEARCH_ENDPOINT=<https://...search.windows.net>
AZURE_SEARCH_KEY=<key>
```

## Google Calendar (One-Way Push)

Set these backend env vars:

```bash
GOOGLE_CALENDAR_CLIENT_ID=<client_id>
GOOGLE_CALENDAR_CLIENT_SECRET=<client_secret>
GOOGLE_CALENDAR_SCOPES=https://www.googleapis.com/auth/calendar.events
```

OAuth Redirect URL to register:
```
<BACKEND_BASE_URL>/api/calendar/google/callback
```

### Azure Validation Checklist

1. Start backend with `ARCADIA_MODE=azure`
2. Check health endpoints:
   - `GET /` should return `"mode": "azure"`
   - `GET /api/health/azure` should return `configured: true` and empty `missing`
3. Upload a PDF/image note and verify OCR succeeds
4. Run chat and verify response latency/content
5. Generate quiz/study materials
6. Trigger translation + TTS
7. Verify no 401/403 from Azure endpoints

If Azure credentials are missing/invalid, features fall back or fail per service behavior.

## Deployment Readiness Checklist

Arcadia is functional but **not fully production-hardened** yet. Before public hosting, review:

1. **Passwords & Auth Security**
   - Current hashing uses SHA-256. Replace with `bcrypt` or `argon2`.
   - Consider moving auth tokens to HttpOnly cookies to reduce XSS risk.
   - Ensure session expiration/rotation is enforced.

2. **CORS + Allowed Origins**
   - Update CORS in `backend/main.py` to your deployed frontend domain.
   - Remove `localhost` in production.

3. **TLS / HTTPS**
   - Ensure HTTPS everywhere (frontend + backend).

4. **Secrets Management**
   - Use environment variables or Azure Key Vault for API keys.
   - Avoid hardcoded secrets.

### Pre-Deploy Verification (Current Project)

Run these checks before deploying:

1. Frontend typecheck:
```bash
cd frontend
npx tsc --noEmit
```

2. Frontend production build:
```bash
cd frontend
npm run build
```

3. Backend syntax sanity check:
```bash
cd backend
python3 -m compileall .
```

5. **Rate Limiting + Abuse Protection**
   - Add rate limits to `/auth`, `/chat`, `/quiz`, `/upload`, `/code/run`.
   - Add upload size limits and throttling.

6. **Database & Persistence**
   - SQLite is fine for dev; use Postgres or managed DB for production.
   - Add backups and migrations.

7. **Observability**
   - Add request logging and centralized error tracking.
   - Enable Azure Application Insights if hosting on Azure.

8. **OAuth Redirects**
   - Ensure OAuth redirect URIs match deployed domains.

9. **Calendar OAuth**
   - Ensure Google Calendar OAuth credentials + redirect URL are configured.
   - Rotate refresh tokens and secure DB storage for calendar tokens.

## Calendar Sync (Planner)

Planner-to-calendar sync is a recommended extension:
- Google Calendar OAuth + event creation
- Outlook/Microsoft Graph OAuth + event creation
- Use note/topic metadata as event descriptions

Suggested production implementation:
1. Store per-user OAuth refresh tokens securely (encrypted at rest)
2. On planner generation/update, upsert calendar events by `study_tasks.id`
3. Sync status back to Arcadia (event id + provider)
4. Handle task reschedule/delete by patch/delete on provider calendar

## Current Status of These Extensions

Email OTP verification, Google Sign-In, and calendar sync are **not yet fully implemented** in this branch. They should be added as production rollout tasks before hosting.

## Authentication Hardening Plan (Hosting)

Recommended options:
1. Email OTP verification flow:
   - Register user as unverified
   - Generate short-lived OTP
   - Deliver OTP via SMTP/provider
   - Verify OTP before enabling normal login
2. Google Sign-In:
   - Add Google OAuth on frontend
   - Verify Google token on backend
   - Link or create Arcadia user
3. Keep both:
   - Google for convenience
   - OTP for email/password account hardening

## Troubleshooting

- If merged note content appears split in UI, ensure files share `note_id`
- If summaries/topics appear stale, use Notes `Regenerate`
- If challenge room disappears on refresh, verify URL has `?room=<CODE>` and room still exists on backend
- If compilers fail in Code Lab, install host runtimes (`node`, `gcc`, `g++`, `javac`, `java`)

## Project Structure

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
  README.md
```
