"""
Arcadia Configuration — Local-first, Azure-ready.
Toggle MODE to switch between local and Azure AI services.
"""
import os
from pathlib import Path

# ─── Deployment Mode ───────────────────────────────────────────
# "local"  → Ollama + Tesseract + ChromaDB + gTTS + deep-translator
# "azure"  → Azure OpenAI + Form Recognizer + AI Search + AI Speech + Translator
MODE = os.getenv("ARCADIA_MODE", "local")

# ─── Paths ─────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
AUDIO_DIR = BASE_DIR / "static" / "audio"
CHROMA_DB_DIR = str(DATA_DIR / "chroma_db")
SQLITE_DB_PATH = str(DATA_DIR / "arcadia.db")

# Ensure directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# ─── Local: Ollama ─────────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")

# ─── Local: Embeddings ────────────────────────────────────────
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384

# ─── Local: Chunking ──────────────────────────────────────────
CHUNK_MAX_TOKENS = 300
CHUNK_OVERLAP_TOKENS = 60

# ─── RAG Retrieval ─────────────────────────────────────────────
RAG_TOP_K = 6  # chunks to retrieve for context

# ─── Quiz ──────────────────────────────────────────────────────
QUIZ_QUESTIONS_PER_TIER = 5
MASTERY_THRESHOLD_TIER2 = 0.7   # need 70% on Tier1 to unlock Tier2
MASTERY_THRESHOLD_TIER3 = 0.8   # need 80% on Tier2 to unlock Tier3

# ─── Supported Languages ──────────────────────────────────────
SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "bn": "Bengali",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
}

# ─── Azure (fill when MODE="azure") ───────────────────────────
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
AZURE_OPENAI_EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")

AZURE_SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT", "")
AZURE_SEARCH_KEY = os.getenv("AZURE_SEARCH_KEY", "")

AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "")

AZURE_TRANSLATOR_KEY = os.getenv("AZURE_TRANSLATOR_KEY", "")
AZURE_TRANSLATOR_REGION = os.getenv("AZURE_TRANSLATOR_REGION", "")

AZURE_FORM_RECOGNIZER_ENDPOINT = os.getenv("AZURE_FORM_RECOGNIZER_ENDPOINT", "")
AZURE_FORM_RECOGNIZER_KEY = os.getenv("AZURE_FORM_RECOGNIZER_KEY", "")
