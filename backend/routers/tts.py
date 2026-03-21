"""
TTS & Translation Router.
"""
from fastapi import APIRouter, HTTPException, Depends
from models.database import User
from routers.auth import get_current_user

from models.schemas import (
    TTSRequest, TTSResponse,
    TranslateRequest, TranslateResponse,
)
from services.tts_service import tts_service
from services.translate_service import translate_service
from config import SUPPORTED_LANGUAGES

router = APIRouter()


@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(
    request: TTSRequest,
    current_user: User = Depends(get_current_user),
):
    """Convert text to speech in the specified language."""
    if request.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language: {request.language}. "
                            f"Supported: {list(SUPPORTED_LANGUAGES.keys())}")
    try:
        audio_url = tts_service.synthesize(request.text, request.language)
    except Exception as e:
        raise HTTPException(500, f"TTS failed: {e}")

    return TTSResponse(audio_url=audio_url, language=request.language)


@router.post("/translate", response_model=TranslateResponse)
async def translate_text(
    request: TranslateRequest,
    current_user: User = Depends(get_current_user),
):
    """Translate text between languages."""
    if request.target_language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported target language: {request.target_language}")

    try:
        translated = translate_service.translate(
            request.text,
            target_language=request.target_language,
            source_language=request.source_language,
        )
    except Exception as e:
        raise HTTPException(500, f"Translation failed: {e}")

    return TranslateResponse(
        original_text=request.text,
        translated_text=translated,
        source_language=request.source_language,
        target_language=request.target_language,
    )


@router.get("/languages")
async def list_languages():
    """List all supported languages."""
    return SUPPORTED_LANGUAGES
