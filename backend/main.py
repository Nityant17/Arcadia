"""
Arcadia Backend — FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from config import AUDIO_DIR, MODE
from models.database import init_db
from services.rag_service import rag_service
from routers import upload, chat, quiz, generate, tts, dashboard, auth, planner, whiteboard, challenge


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    # Startup
    print(f"🚀 Arcadia starting in [{MODE.upper()}] mode")
    init_db()
    rag_service.initialize()
    print("✅ Services ready")
    yield
    # Shutdown
    print("👋 Arcadia shutting down")


app = FastAPI(
    title="Arcadia API",
    description="Multimodal Adaptive Mastery Engine — AI Study Buddy",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS (allow React/Vite frontend during dev) ─────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static files (TTS audio) ────────────────────────────────
app.mount("/static", StaticFiles(directory=str(AUDIO_DIR.parent)), name="static")

# ─── Routers ──────────────────────────────────────────────────
app.include_router(upload.router,    prefix="/api", tags=["Upload & OCR"])
app.include_router(chat.router,      prefix="/api", tags=["RAG Chat"])
app.include_router(quiz.router,      prefix="/api", tags=["Adaptive Quiz"])
app.include_router(generate.router,  prefix="/api", tags=["Generate Study Materials"])
app.include_router(tts.router,       prefix="/api", tags=["TTS & Translation"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard & Mastery"])
app.include_router(auth.router,      prefix="/api", tags=["Auth"])
app.include_router(planner.router,   prefix="/api", tags=["Timetable & Spaced Repetition"])
app.include_router(whiteboard.router, prefix="/api", tags=["Whiteboard Hints"])
app.include_router(challenge.router, prefix="/api", tags=["Challenge Rooms"])


@app.get("/", tags=["Health"])
async def health():
    return {"status": "ok", "mode": MODE, "service": "Arcadia API"}
