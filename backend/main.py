"""
Arcadia Backend — FastAPI Application Entry Point
"""
import logging
import time
from collections import deque
from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from threading import Lock

from config import (
    AUDIO_DIR,
    MODE,
    CORS_ALLOWED_ORIGINS,
    MAX_CODE_PAYLOAD_BYTES,
    MAX_CODE_PAYLOAD_MB,
    MAX_UPLOAD_SIZE_BYTES,
    MAX_UPLOAD_SIZE_MB,
    RATE_LIMIT_AUTH_PER_WINDOW,
    RATE_LIMIT_CHAT_PER_WINDOW,
    RATE_LIMIT_CODE_RUN_PER_WINDOW,
    RATE_LIMIT_QUIZ_PER_WINDOW,
    RATE_LIMIT_UPLOAD_PER_WINDOW,
    RATE_LIMIT_WINDOW_SECONDS,
    REQUEST_LOGGING_ENABLED,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_VISION_DEPLOYMENT,
    AZURE_SPEECH_KEY,
    AZURE_SPEECH_REGION,
    AZURE_TRANSLATOR_KEY,
    AZURE_TRANSLATOR_REGION,
)
from models.database import init_db
from services.rag_service import rag_service
from routers import upload, chat, quiz, generate, tts, dashboard, auth, planner, whiteboard, challenge, code_runner, user, calendar

logger = logging.getLogger("arcadia.api")
if REQUEST_LOGGING_ENABLED and not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

_RATE_LIMIT_RULES = {
    "/api/auth": RATE_LIMIT_AUTH_PER_WINDOW,
    "/api/chat": RATE_LIMIT_CHAT_PER_WINDOW,
    "/api/quiz": RATE_LIMIT_QUIZ_PER_WINDOW,
    "/api/upload": RATE_LIMIT_UPLOAD_PER_WINDOW,
    "/api/code/run": RATE_LIMIT_CODE_RUN_PER_WINDOW,
}
_rate_limit_state: dict[str, deque[float]] = {}
_rate_limit_lock = Lock()


def _matched_rate_limit(path: str) -> tuple[str, int] | tuple[None, None]:
    for prefix, limit in _RATE_LIMIT_RULES.items():
        if path.startswith(prefix):
            return prefix, limit
    return None, None


def _is_rate_limited(client_key: str, route_prefix: str, limit: int) -> bool:
    now = time.time()
    key = f"{client_key}:{route_prefix}"

    with _rate_limit_lock:
        hits = _rate_limit_state.setdefault(key, deque())
        cutoff = now - RATE_LIMIT_WINDOW_SECONDS
        while hits and hits[0] < cutoff:
            hits.popleft()

        if len(hits) >= limit:
            return True

        hits.append(now)
        return False


def _azure_env_status() -> dict:
    checks = {
        "AZURE_OPENAI_ENDPOINT": AZURE_OPENAI_ENDPOINT,
        "AZURE_OPENAI_KEY": AZURE_OPENAI_KEY,
        "AZURE_OPENAI_VISION_DEPLOYMENT": AZURE_OPENAI_VISION_DEPLOYMENT,
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

# ─── Runtime protection + observability ───────────────────────
@app.middleware("http")
async def runtime_guardrails(request: Request, call_next):
    path = request.url.path or "/"
    method = (request.method or "").upper()
    content_length = int(request.headers.get("content-length", "0") or 0)
    client_host = request.client.host if request.client else "unknown"

    if path == "/api/upload" and method == "POST" and content_length > MAX_UPLOAD_SIZE_BYTES:
        return JSONResponse(
            status_code=413,
            content={
                "detail": f"Upload too large. Max allowed size is {MAX_UPLOAD_SIZE_MB} MB.",
            },
        )
    if path == "/api/code/run" and method == "POST" and content_length > MAX_CODE_PAYLOAD_BYTES:
        return JSONResponse(
            status_code=413,
            content={
                "detail": f"Payload too large for code execution. Max allowed size is {MAX_CODE_PAYLOAD_MB} MB.",
            },
        )

    route_prefix, limit = _matched_rate_limit(path)
    if route_prefix and limit and _is_rate_limited(client_host, route_prefix, limit):
        return JSONResponse(
            status_code=429,
            content={
                "detail": (
                    f"Rate limit exceeded for {route_prefix}. "
                    f"Try again in {RATE_LIMIT_WINDOW_SECONDS} seconds."
                )
            },
        )

    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        if REQUEST_LOGGING_ENABLED:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.exception("%s %s -> exception (%.1fms)", method, path, duration_ms)
        raise

    if REQUEST_LOGGING_ENABLED:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.info("%s %s -> %s (%.1fms)", method, path, response.status_code, duration_ms)
    return response


# ─── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
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
app.include_router(user.router, prefix="/api", tags=["User"])
app.include_router(calendar.router, prefix="/api", tags=["Calendar"])


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
