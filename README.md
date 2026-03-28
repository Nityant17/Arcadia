# Arcadia

Arcadia is an AI-first study platform with a FastAPI backend and a React + TypeScript frontend.
It supports note ingestion, RAG chat, quiz generation, study-material generation, planning, dashboard analytics, multilingual translation, and browser-playable TTS.

## Architecture (Current)

### Frontend
- Stack: React 19, TypeScript, Vite, TanStack Router, TanStack Query, Zustand, Tailwind.
- Main app routes are defined in `frontend/src/App.tsx`.
- Core pages: `/auth`, `/home`, `/notes`, `/chat`, `/study`, `/quiz`, `/planner`, `/dashboard`, `/challenge`, `/code`, `/game`, `/galaxy`.
- Chat assistant responses now render Markdown using `react-markdown` + `remark-gfm`.

### Backend
- Stack: FastAPI, SQLAlchemy, SQLite/PostgreSQL, pgvector-ready architecture.
- Router modules in `backend/routers/`:
  - `auth.py`, `upload.py`, `chat.py`, `quiz.py`, `generate.py`, `tts.py`, `translate` (inside `tts.py`), `dashboard.py`, `planner.py`, `calendar.py`, `challenge.py`, `code_runner.py`, `whiteboard.py`, `user.py`.
- Service modules in `backend/services/`:
  - `llm_service.py` (Ollama/Azure OpenAI abstraction)
  - `rag_service.py` (chunking/retrieval/embeddings pipeline)
  - `quiz_service.py`, `generate_service.py`, `note_service.py`, `tts_service.py`, `translate_service.py`, `ocr_service.py`, `safety_service.py`, `streak_service.py`.

### Data Model Pattern
Arcadia uses a **logical note model**:
- Each uploaded file is a `Document`.
- Related files share one `note_id`.
- A `Note` represents the grouped logical study unit.

This enables multi-file context in chat, quiz, and generation without physically merging files.

### TTS + Markdown Handling (Current Behavior)
- TTS endpoint (`POST /api/tts`) streams audio bytes directly with media type (`audio/mpeg`) for browser playback.
- Markdown is sanitized to plain text before synthesis in `backend/services/tts_service.py`.
- Chat UI renders Markdown instead of raw symbols in `frontend/src/pages/ChatPage.tsx`.

## Repository Layout

```text
Arcadia/
  backend/
    main.py
    config.py
    models/
    routers/
    services/
  frontend/
    src/
      pages/
      components/
      hooks/
      services/
      store/
  assets/
    screenshots/
    diagrams/
  README.md
```

## Local Setup

### 1) Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

### 2) Frontend
```bash
cd frontend
npm install
cp .env.example .env
npx vite --port 5173
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:8000`

## Frontend Dependencies for Markdown Chat

Install these in `frontend/`:
```bash
npm install react-markdown remark-gfm
```

## Env Configuration

### Backend (`backend/.env`)
```bash
ARCADIA_MODE=local
DATABASE_URL=sqlite:///./arcadia.db
CORS_ALLOWED_ORIGINS=http://localhost:5173
AUTH_FRONTEND_URL=http://localhost:5173
```

### Azure Mode (optional)
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

### Frontend (`frontend/.env`)
```bash
VITE_API_BASE_URL=http://localhost:8000/api
```

## Screenshot Plan (Exact Shots to Take)

Create folders first:
```bash
mkdir -p assets/screenshots assets/diagrams
```

Then capture these exact pages and save with these exact names:

1. `assets/screenshots/01_auth_page.png`
- Open `/auth`
- Show login + register panel in one frame.

2. `assets/screenshots/02_home_overview.png`
- Open `/home`
- Include quick actions + recent notes area.

3. `assets/screenshots/03_notes_workspace.png`
- Open `/notes`
- Show note list and one selected note metadata.

4. `assets/screenshots/04_chat_markdown_tts.png`
- Open `/chat`
- Ask for a response with headings + bullet points + bold text.
- Keep one assistant message expanded, sources visible, and TTS button visible.

5. `assets/screenshots/05_study_generation.png`
- Open `/study`
- Show cheatsheet/flashcards/diagram result cards.

6. `assets/screenshots/06_quiz_attempt.png`
- Open `/quiz`
- Show active question and options.

7. `assets/screenshots/07_planner_calendar.png`
- Open `/planner`
- Show generated tasks and calendar integration state.

8. `assets/screenshots/08_dashboard_metrics.png`
- Open `/dashboard`
- Show mastery stats and recent activity.

9. `assets/screenshots/09_challenge_or_code.png`
- Open `/challenge` or `/code`
- Show one live room or code execution result.

After saving screenshots, verify:
```bash
ls -1 assets/screenshots
```

## AI Diagram Prompts (Use These)

Use these prompts in your diagram-generation tool and export PNG/SVG into `assets/diagrams/`.

### 1) System Architecture
Save as: `assets/diagrams/01_system_architecture.png`

Prompt:
```text
Create a clean production architecture diagram for an app called Arcadia.
Show two major layers: React Frontend and FastAPI Backend.
Frontend includes: TanStack Router, TanStack Query, Zustand Store, Pages (Auth, Home, Notes, Chat, Study, Quiz, Planner, Dashboard).
Backend includes routers: auth, upload, chat, quiz, generate, tts/translate, dashboard, planner, calendar, challenge, code_runner.
Backend services: llm_service, rag_service, note_service, quiz_service, generate_service, tts_service, translate_service, ocr_service.
Data layer: SQL database with Document, Note, ChatHistory, QuizAttempt, PlannerTask.
External integrations: Ollama OR Azure OpenAI, Azure Speech, Azure Translator, OCR providers.
Add arrows for request flow and retrieval flow. Style should be modern, minimal, dark-on-light, labeled clearly.
```

### 2) Chat + RAG + TTS Sequence
Save as: `assets/diagrams/02_chat_rag_tts_sequence.png`

Prompt:
```text
Create a sequence diagram for Arcadia chat lifecycle.
Actors: User, React ChatPage, FastAPI /api/chat, note_service, rag_service, llm_service, DB, FastAPI /api/tts, tts_service, Browser Audio.
Flow:
1) User sends query.
2) ChatPage calls /api/chat.
3) Backend resolves note/document context.
4) RAG retrieves chunks.
5) LLM generates markdown answer.
6) UI renders markdown.
7) User clicks TTS.
8) ChatPage calls /api/tts.
9) tts_service strips markdown to plain text.
10) TTS synthesizes audio and /api/tts streams audio/mpeg.
11) Browser plays audio.
Use clear lifelines and numbered steps.
```

### 3) Data Model ERD
Save as: `assets/diagrams/03_data_model_erd.png`

Prompt:
```text
Create an ERD for Arcadia with entities:
User, Note, Document, ChatHistory, QuizAttempt, PlannerTask, GeneratedContent.
Show that one Note has many Documents (logical note grouping).
Include key fields like ids, user_id, note_id, created_at, content blobs, scores/status.
Show one-to-many and many-to-one relations.
Style with readable tables and relationship connectors.
```

### 4) Quiz Engine Flow
Save as: `assets/diagrams/04_quiz_engine_flow.png`

Prompt:
```text
Create a flowchart for Arcadia adaptive quiz engine.
Steps: Select note context -> choose tier/topic/language -> generate questions -> user answers -> evaluate correctness -> compute score/mastery -> persist quiz attempt -> update dashboard metrics -> unlock next tier when threshold met.
Include error paths for invalid context and regeneration.
Use concise labels and production-style flowchart blocks.
```

### 5) Deployment View
Save as: `assets/diagrams/05_deployment_view.png`

Prompt:
```text
Create a deployment diagram for Arcadia.
Show: Browser client, Frontend hosting (Vite static build), Backend FastAPI service, SQL database, optional Redis/cache, Object/static storage for assets/audio cache, external AI services (Ollama local or Azure OpenAI, Azure Speech, Azure Translator).
Include environment separation: Local mode and Azure mode.
Show secure API boundary and auth token flow.
```

## README Image Embeds

After generating images, keep this section in README and just ensure files exist:

```md
## Product Screens
![Auth](assets/screenshots/01_auth_page.png)
![Home](assets/screenshots/02_home_overview.png)
![Notes](assets/screenshots/03_notes_workspace.png)
![Chat Markdown + TTS](assets/screenshots/04_chat_markdown_tts.png)
![Study Generation](assets/screenshots/05_study_generation.png)
![Quiz](assets/screenshots/06_quiz_attempt.png)
![Planner](assets/screenshots/07_planner_calendar.png)
![Dashboard](assets/screenshots/08_dashboard_metrics.png)
![Challenge/Code](assets/screenshots/09_challenge_or_code.png)

## Architecture Diagrams
![System Architecture](assets/diagrams/01_system_architecture.png)
![Chat RAG TTS Sequence](assets/diagrams/02_chat_rag_tts_sequence.png)
![Data Model ERD](assets/diagrams/03_data_model_erd.png)
![Quiz Engine Flow](assets/diagrams/04_quiz_engine_flow.png)
![Deployment View](assets/diagrams/05_deployment_view.png)
```

## API Surface (High-Level)

Base path: `/api`

- Auth: `/auth/*`
- Upload & Notes: `/upload`, `/documents`, `/notes`, `/documents/{id}/topics`
- Chat: `/chat`, `/chat/stream`, `/chat/history/{document_id}`
- Study generation: `/generate/cheatsheet`, `/generate/flashcards`, `/generate/diagram`
- Quiz: `/quiz/generate`, `/quiz/submit`, `/quiz/history`
- TTS/Translation: `/tts`, `/translate`, `/languages`
- Dashboard: `/dashboard/stats`, `/dashboard/mastery`, `/dashboard/recent-quizzes`, `/dashboard/reset`
- Planner/Calendar: `/planner/*`, `/calendar/google/*`
- Challenge: `/challenge/*`
- Code runner: `/code/run`

## Validation Checklist Before Production

1. Chat renders Markdown headings/bullets/bold correctly.
2. Clicking TTS plays audio for assistant response.
3. No `<audio> no supported source` browser error.
4. `/api/tts` returns `200` with `Content-Type: audio/mpeg`.
5. Images and diagrams in README are present and load on GitHub preview.
