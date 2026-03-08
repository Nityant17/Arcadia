#!/bin/bash
# Arcadia — Setup Script
# Run this once to set up everything on your local machine.

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║    🎓 Arcadia Setup — AI Study Buddy         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ─── 1. Check system dependencies ─────────────────────
echo "📋 Checking system dependencies..."

check_cmd() {
    if command -v "$1" &>/dev/null; then
        echo "  ✅ $1 found"
    else
        echo "  ❌ $1 NOT found — $2"
        return 1
    fi
}

MISSING=0
check_cmd python3 "Install Python 3.10+" || MISSING=1
check_cmd pip3 "Should come with Python" || check_cmd pip "pip alternative" || MISSING=1
check_cmd tesseract "Install: sudo apt install tesseract-ocr" || MISSING=1
check_cmd ollama "Install: curl -fsSL https://ollama.com/install.sh | sh" || MISSING=1

echo ""

if [ "$MISSING" -eq 1 ]; then
    echo "⚠️  Some dependencies are missing. Install them and re-run this script."
    echo "   For Ubuntu/Debian:"
    echo "   sudo apt update && sudo apt install -y tesseract-ocr tesseract-ocr-hin poppler-utils python3-venv"
    echo ""
    echo "   For Ollama:"
    echo "   curl -fsSL https://ollama.com/install.sh | sh"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi
fi

# ─── 2. Backend setup ─────────────────────────────────
echo "🐍 Setting up Python backend..."
cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  Created virtual environment"
fi

source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "  ✅ Backend dependencies installed"

# ─── 3. Check Ollama model ────────────────────────────
echo ""
echo "🤖 Checking Ollama model..."
if ollama list 2>/dev/null | grep -q "mistral"; then
    echo "  ✅ mistral model found"
else
    echo "  ⬇️  Pulling mistral model (this may take a few minutes)..."
    ollama pull mistral
fi

# ─── 4. Flutter setup (if available) ──────────────────
echo ""
if command -v flutter &>/dev/null; then
    echo "📱 Setting up Flutter frontend..."
    cd "$SCRIPT_DIR/frontend/arcadia_app"
    flutter pub get 2>/dev/null || echo "  ⚠️  flutter pub get failed — run manually"
    echo "  ✅ Flutter dependencies resolved"
else
    echo "📱 Flutter not found — install from https://docs.flutter.dev/get-started/install"
    echo "   Backend will still work. You can test API via http://localhost:8000/docs"
fi

# ─── Done ─────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║    ✅ Setup complete!                         ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  Start the backend:                          ║"
echo "║    cd backend                                ║"
echo "║    source venv/bin/activate                  ║"
echo "║    uvicorn main:app --reload --port 8000     ║"
echo "║                                              ║"
echo "║  Start the frontend:                         ║"
echo "║    cd frontend/arcadia_app                   ║"
echo "║    flutter run -d chrome                     ║"
echo "║                                              ║"
echo "║  API docs: http://localhost:8000/docs        ║"
echo "╚══════════════════════════════════════════════╝"
