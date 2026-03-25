"""
Arcadia Backend — FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from config import (
    AUDIO_DIR,
    MODE,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
    AZURE_FORM_RECOGNIZER_ENDPOINT,
    AZURE_FORM_RECOGNIZER_KEY,
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION,
    AZURE_TRANSLATOR_KEY,
    AZURE_TRANSLATOR_REGION,
)
from models.database import init_db
from services.rag_service import rag_service
from routers import upload, chat, quiz, generate, tts, dashboard, auth, planner, whiteboard, challenge, code_runner


def _azure_env_status() -> dict:
    checks = {
        "AZURE_OPENAI_ENDPOINT": AZURE_OPENAI_ENDPOINT,
        "AZURE_OPENAI_KEY": AZURE_OPENAI_KEY,
        "AZURE_FORM_RECOGNIZER_ENDPOINT": AZURE_FORM_RECOGNIZER_ENDPOINT,
        "AZURE_FORM_RECOGNIZER_KEY": AZURE_FORM_RECOGNIZER_KEY,
        "AZURE_SPEECH_KEY": AZURE_SPEECH_KEY,
        "AZURE_SPEECH_REGION": AZURE_SPEECH_REGION,
        "AZURE_TRANSLATOR_KEY": AZURE_TRANSLATOR_KEY,
        "AZURE_TRANSLATOR_REGION": AZURE_TRANSLATOR_REGION,
    }
    missing = [name for name, value in checks.items() if not str(value or "").strip()]
    return {"configured": len(missing) == 0, "missing": missing}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    # Startup
    print(f"🚀 Arcadia starting in [{MODE.upper()}] mode")
    if MODE == "azure":
        azure_status = _azure_env_status()
        missing = azure_status["missing"]
        if missing:
            print(f"⚠️ Azure mode enabled but missing env vars: {', '.join(missing)}")
        else:
            print("✅ Azure environment variables detected")
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
app.include_router(code_runner.router, prefix="/api", tags=["Code Runner"])


@app.get("/", tags=["Health"])
async def health():
    payload = {"status": "ok", "mode": MODE, "service": "Arcadia API"}
    if MODE == "azure":
        payload["azure"] = _azure_env_status()
    return payload


@app.get("/api/health/azure", tags=["Health"])
async def azure_health():
    if MODE != "azure":
        return {"mode": MODE, "configured": False, "missing": [], "message": "ARCADIA_MODE is not set to azure"}
    azure_status = _azure_env_status()
    return {"mode": MODE, **azure_status}
