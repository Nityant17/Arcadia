# Arcadia

![Arcadia App Overview](./assets/screenshots/00_hero.png)

<p align="center">
  <strong>AI-first study workspace for turning raw notes into real understanding.</strong>
</p>

<p align="center">
  Upload your material once. Chat with it, generate study assets, practice adaptively,<br>
  battle friends, execute code, plan sessions, and track progress — all in one place.
</p>

<p align="center">
  UI note: <strong>Light mode is available</strong>, but <strong>dark mode is the recommended experience</strong>.
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white">
  <img alt="AI" src="https://img.shields.io/badge/AI-Ollama%20%7C%20Azure_OpenAI-111827">
  <img alt="Microsoft" src="https://img.shields.io/badge/Microsoft-UNLOCKED_Hackathon-00A4EF?logo=microsoft&logoColor=white">
</p>

---

## For Judges — Quick Start

| Resource | Link |
|----------|------|
| 🎬 Video Demo | `[Coming Soon]` |
| 🌐 Live Application | https://arcadia-two-iota.vercel.app/ |
| 🔑 Demo Login | Email + password auth — no OAuth required for demo |

> **OAuth note:** Google Sign-In and OTP confirmation are implemented in the backend. Provider API keys are the only thing not activated (billing required). The buttons can be re-enabled by adding `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the environment.

---

## What Is Arcadia?

Most student tools solve one slice of the learning workflow. Arcadia solves the entire loop.

The core idea: **upload your study material once, and every feature draws from the same context**. Chat asks questions from it. Quizzes test you on it. Cheatsheets compress it. Flashcards drill it. The planner schedules around it. The dashboard tracks your mastery of it.

No context switching. No re-uploading. No tool fragmentation.

---

## Table of Contents

- [Judging Alignment](#judging-alignment)
- [Feature Tour](#feature-tour)
- [App Screenshots](#app-screenshots)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Responsible AI & Security](#responsible-ai--security)
- [Gamification](#gamification)
- [Future Roadmap](#future-roadmap)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Deployment](#deployment)

---

## Judging Alignment

| Evaluation Criterion | How Arcadia Addresses It |
|---|---|
| **Problem Depth & Product Clarity (25 pts)** | Targets the specific pain of fragmented student workflows, passive revision, and multilingual barriers — not generic "AI for education" |
| **MVP Readiness & Scalability (20 pts)** | Full-stack product with working core loop, modular backend, split deployment, and env-based AI provider switching |
| **Communication, Presentation & UX (20 pts)** | Workspace-driven navigation, markdown chat rendering, TTS, gamified engagement, multi-language support |
| **System Architecture & Engineering (15 pts)** | Modular FastAPI router/service pattern, typed frontend API layer, logical note model as shared context boundary |
| **AI Integration & Intelligence Design (10 pts)** | AI used for OCR routing, RAG chat, quiz generation, study generation, translation, TTS, and responsible content filtering |
| **Market Understanding & Product Fit (10 pts)** | Sits at the intersection of note-grounded AI + active recall + accessibility — distinct from ChatGPT, Quizlet, and Notion AI |

---

## Feature Tour

### Core Study Loop

| Workspace | What It Does |
|-----------|-------------|
| **Notes & Ingestion** | Upload PDFs, images, or handwritten notes. Group multiple files under one logical note (`note_id`). OCR routing: handwritten → GPT-4o Vision; printed → Azure Form Recognizer. |
| **RAG Chat** | Ask questions grounded in your uploaded material — not generic AI. Retrieval-Augmented Generation with markdown answers, source grounding, and optional TTS playback. |
| **Study Workspace** | Generate cheatsheets, flashcards, and Mermaid concept diagrams from your note context. Study state is cached per note — resume exactly where you left off. |
| **Adaptive Quiz** | Active recall quizzes generated from your note context. Includes an **in-quiz whiteboard canvas** where you sketch your thinking and get live AI hints based on what you drew. |
| **Planner & Calendar** | Turn learning goals into scheduled study tasks. Google Calendar sync backend is ready — activation requires provider API keys. |
| **Dashboard & Streaks** | Mastery tracking, activity logs, learning streaks, and study consistency metrics over time. |
| **Multilingual + TTS** | Translate any study content to another language. Text-to-speech converts answers and study assets into browser-playable audio. |

### Engagement & Power Features

| Feature | Description |
|---------|-------------|
| **Challenge Room** | Real-time head-to-head quiz battles against friends. Live scoring and leaderboard. |
| **Code Lab** | Upload code files directly into a live coding environment. Code is auto-pasted into the editor and ready to run immediately. |
| **Galaxy Gamification** | Every login and completed study session adds to your personal constellation map. Watch your galaxy expand as you learn. Completing challenges unlocks new constellations. |
| **Multi-Document Notes** | Upload three PDFs for the same subject and group them into one combined note. Arcadia treats them as a single study corpus across all features. |

---

## App Screenshots

### Home Overview
![Home Overview](./assets/screenshots/01_home_overview.png)
---

### Auth Page
![Auth Page](./assets/screenshots/02_auth.png)
---

### Notes Workspace
![Notes Workspace](./assets/screenshots/03_notes_workspace.png)
---

### RAG Chat
![Chat Markdown Answer](./assets/screenshots/04_chat_markdown.png)

![Chat TTS Active](./assets/screenshots/05_chat_tts.png)
---

### Study Workspace
![Study Workspace](./assets/screenshots/06_study_workspace.png)
---

### Quiz + Whiteboard
![Quiz with Whiteboard](./assets/screenshots/07_quiz_whiteboard.png)
---

### Challenge Room
![Challenge Room](./assets/screenshots/08_challenge_room.png)
---

### Code Lab
![Code Lab](./assets/screenshots/09_code_lab.png)
---

### Dashboard
![Dashboard](./assets/screenshots/10_dashboard.png)
---

### Galaxy
![Galaxy](./assets/screenshots/11_galaxy.png)
---

### Planner
![Planner](./assets/screenshots/12_planner.png)
---

## Architecture

### System Architecture

![Arcadia System Architecture](./assets/flowcharts/01_system_architecture.png)

The system is a React 19 frontend communicating with a modular FastAPI backend through a typed Axios client. The backend is organized into separate router modules, each backed by a corresponding service layer. AI providers are swapped at the environment level — Ollama locally, Azure in production.

---

### The Logical Note Model

![Arcadia Logical Note Model](./assets/flowcharts/02_logical_note_model.png)

This is the core architectural idea. Uploaded documents stay as separate `Document` records in the database but share a `note_id`. Every feature resolves context through that key. A student studying thermodynamics can upload a lecture PDF, a handwritten diagram, and a summary slide deck — all three become one unified study corpus.

---

### OCR Routing Decision Tree

![Arcadia OCR Routing](./assets/flowcharts/03_ocr_routing.png)

Every file upload passes through the safety service first. If cleared, the user's chosen OCR mode determines the path: handwritten input goes to GPT-4o Vision; printed input goes to Azure Form Recognizer. Both fall back to Tesseract when running in local mode.

---

### End-to-End User Flow

![Arcadia User Flow](./assets/flowcharts/04_user_flow.png)

The full journey from login through ingestion, the study loop, the engagement layer, and progress tracking. Dashed lines indicate features that are backend-ready but require external credentials to activate.

---

### RAG & Study Generation Pipeline

![Arcadia RAG Pipeline](./assets/flowcharts/05_rag_pipeline.png)

Phase 1 handles ingestion: safety check, OCR, chunking, and vector storage. Phase 2 is RAG chat: similarity search retrieves the most relevant chunks, which are passed to the LLM as grounded context. Phase 3 is study generation: cached assets are served instantly on return visits; otherwise cheatsheet, flashcards, and diagram are generated and cached together.

---

### Responsible AI & Safety Flow

![Arcadia Responsible AI](./assets/flowcharts/06_responsible_ai.png)

The `safety_service` sits at the ingestion boundary. All uploaded images and text pass through it before reaching OCR or the database. Explicit imagery and harmful text are blocked at this layer and never stored. Legitimate academic content passes through cleanly.

---

### Scalability & Future Roadmap

![Arcadia Roadmap](./assets/flowcharts/07_scalability_roadmap.png)

The architecture scales from local development (Ollama, SQLite) to production (Azure OpenAI, PostgreSQL, Vercel + Render) with only environment variable changes. The roadmap moves through auth activation, a PYQ engine, gamified learning paths, and an adaptive AI tutoring engine that builds a personalised teaching profile per learner.

---

## Tech Stack

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Routing | TanStack Router |
| Server state | TanStack Query |
| Client state | Zustand |
| Styling | Tailwind CSS |
| Diagrams | Mermaid (rendered in-browser) |
| Markdown | React Markdown + remark-gfm |
| HTTP | Axios (typed API client layer) |
| Build | Vite |

### Backend

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI |
| ORM | SQLAlchemy |
| Database | SQLite (default) → PostgreSQL-ready |
| Embeddings | sentence-transformers |
| OCR (local) | pytesseract + pdf2image + PyPDF2 |
| Audio (local) | gTTS |
| Translation (local) | deep-translator |
| HTTP client | httpx |
| Auth | JWT — email/password active; OAuth backend ready |

### AI Runtime

| Mode | Services |
|------|---------|
| **Local (default)** | Ollama + Tesseract OCR + gTTS + deep-translator + Chroma vectors |
| **Azure (production)** | Azure OpenAI (chat + embeddings) + GPT-4o Vision (handwritten OCR) + Azure Form Recognizer (printed OCR) + Azure Speech (TTS) + Azure Translator |

---

## Responsible AI & Security

Arcadia treats safety as a first-class service, not an afterthought.

- **Content filtering at ingestion:** The `safety_service` checks every uploaded file and text input before it enters the system. Explicit images and harmful text instructions are blocked immediately and never reach the database or vector store.
- **Per-user data isolation:** All notes, documents, study materials, and quiz results are scoped to the authenticated user. The API enforces this at the router level.
- **Auth architecture:** JWT tokens with proper expiry and refresh. Email/password login is fully functional. OAuth (Google Sign-In + OTP) is fully wired in the backend — activation requires provider credentials.
- **Input validation:** All API endpoints validate inputs at the FastAPI layer before processing.

---

## Gamification

Arcadia uses a galaxy / constellation reward system to encourage consistent learning:

- **Login rewards:** Each daily login adds a star to the user's personal galaxy map.
- **Completion rewards:** Finishing a quiz, generating study materials, or completing a challenge unlocks new constellation patterns.
- **Challenge Room:** Head-to-head quiz battles with friends, live scoring, and a leaderboard.
- **Visual progress:** Users watch their personal universe expand over time — a more meaningful signal than a number on a streak counter.

---

## Future Roadmap

### Near-term (credentials pending)

- **Google Sign-In + OTP** — backend fully implemented; needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- **Google Calendar sync** — backend router live; needs Calendar API credentials
- **Microsoft Login + Outlook Calendar** — planned next after Google

### v2 Features

- **PYQ Engine:** Enter your institute or school name. Arcadia fetches their previous year question papers and generates practice questions with full topic analysis, difficulty distribution, and high-frequency pattern breakdown.
- **Gamified learning paths:** Structured missions and quests that guide learners progressively through a topic.
- **Mobile app:** React Native port of the core study loop.
- **Spaced repetition:** Topic-level mastery curves and personalised revision reminders.

### v3 — Adaptive AI Tutoring Engine

The flagship long-term vision:

1. Arcadia quizzes the learner across a topic to gauge current understanding.
2. It analyses answer patterns to identify weak subtopics and misconceptions.
3. It tries multiple teaching approaches — analogies, worked examples, visual diagrams, Socratic questioning.
4. It measures which style produces the fastest improvement for that specific learner.
5. It builds a persistent, personalised teaching profile and adapts every future session accordingly.

This is not "AI that answers questions." It is AI that learns how *you* learn.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- `pip` and `npm`
- Ollama (for local AI mode)
- Tesseract and Poppler (for local OCR)

### 1. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

Backend at `http://localhost:8000` · API docs at `http://localhost:8000/docs`

### 2. Start the frontend

```bash
cd frontend
npm install
cp .env.example .env
npx vite --port 5173
```

Frontend at `http://localhost:5173`

---

## Configuration

### Core backend environment

```bash
ARCADIA_MODE=local
DATABASE_URL=sqlite:///./arcadia.db
CORS_ALLOWED_ORIGINS=http://localhost:5173
AUTH_FRONTEND_URL=http://localhost:5173
SECRET_KEY=<your-jwt-secret>
```

### Azure mode

```bash
ARCADIA_MODE=azure
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_VISION_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_FORM_RECOGNIZER_ENDPOINT=https://<resource>.cognitiveservices.azure.com
AZURE_FORM_RECOGNIZER_KEY=<key>
AZURE_SPEECH_KEY=<key>
AZURE_SPEECH_REGION=<region>
AZURE_TRANSLATOR_KEY=<key>
AZURE_TRANSLATOR_REGION=<region>
```

### OAuth (backend ready)

```bash
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
```

### Frontend

```bash
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## Deployment

| Service | Platform | Config |
|---------|----------|--------|
| Frontend | Vercel | `frontend/vercel.json` |
| Backend | Render (Docker) | `render.yaml` |

---

## Repository Structure

```
Arcadia/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── models/
│   ├── routers/          # auth, upload, chat, generate, quiz,
│   │                     # tts, translate, planner, calendar,
│   │                     # dashboard, challenge, code_runner,
│   │                     # whiteboard, user
│   ├── services/         # rag, llm, note, generate, quiz,
│   │                     # ocr, tts, translate, safety, streak
│   └── data/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/
│   │   └── hooks/
│   └── vercel.json
├── assets/
│   ├── screenshots/      # ← add your 10 app screenshots here
│   └── flowcharts/       # ← place the 7 generated diagram PNGs here
├── docs/submission/
├── render.yaml
└── README.md
```
