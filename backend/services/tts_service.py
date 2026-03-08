"""
TTS Service — Text-to-Speech.
Local: gTTS (Google Text-to-Speech, free)
Azure: Azure AI Speech (Neural TTS with Indic voices)
"""
import os
import uuid
import hashlib
from pathlib import Path

from gtts import gTTS

from config import (
    MODE, AUDIO_DIR, SUPPORTED_LANGUAGES,
    AZURE_SPEECH_KEY, AZURE_SPEECH_REGION,
)


# gTTS language codes (slightly different from our codes)
GTTS_LANG_MAP = {
    "en": "en",
    "hi": "hi",
    "ta": "ta",
    "te": "te",
    "mr": "mr",
    "bn": "bn",
    "gu": "gu",
    "kn": "kn",
    "ml": "ml",
}


class TTSService:

    def synthesize(self, text: str, language: str = "en") -> str:
        """
        Convert text to speech and return the URL path to the audio file.
        Returns: relative URL path like /static/audio/abc123.mp3
        """
        if MODE == "azure":
            print(f"[TTS] Using AZURE Speech — region: {AZURE_SPEECH_REGION}, lang: {language}")
            return self._azure_tts(text, language)
        print(f"[TTS] Using LOCAL gTTS — lang: {language}")
        return self._local_tts(text, language)

    def _local_tts(self, text: str, language: str) -> str:
        """Use gTTS for free text-to-speech."""
        lang_code = GTTS_LANG_MAP.get(language, "en")

        # Deterministic filename based on text hash (cache)
        text_hash = hashlib.md5(f"{text}_{lang_code}".encode()).hexdigest()[:16]
        filename = f"tts_{text_hash}.mp3"
        filepath = AUDIO_DIR / filename

        if not filepath.exists():
            # Truncate very long text for TTS
            tts_text = text[:5000] if len(text) > 5000 else text
            tts = gTTS(text=tts_text, lang=lang_code, slow=False)
            tts.save(str(filepath))

        return f"/static/audio/{filename}"

    def _azure_tts(self, text: str, language: str) -> str:
        """Azure AI Speech with neural voices via REST API."""
        import hashlib
        import httpx

        # Azure voice names for supported languages
        voice_map = {
            "en": "en-US-JennyNeural",
            "hi": "hi-IN-SwaraNeural",
            "ta": "ta-IN-PallaviNeural",
            "te": "te-IN-ShrutiNeural",
            "mr": "mr-IN-AarohiNeural",
            "bn": "bn-IN-TanishaaNeural",
            "gu": "gu-IN-DhwaniNeural",
            "kn": "kn-IN-SapnaNeural",
            "ml": "ml-IN-SobhanaNeural",
        }
        voice = voice_map.get(language, "en-US-JennyNeural")

        # Deterministic filename (cache)
        text_hash = hashlib.md5(f"{text}_{language}_azure".encode()).hexdigest()[:16]
        filename = f"tts_{text_hash}.mp3"
        filepath = AUDIO_DIR / filename

        if filepath.exists():
            return f"/static/audio/{filename}"

        # Step 1: Get access token
        token_url = f"https://{AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
        with httpx.Client(timeout=30.0) as client:
            token_resp = client.post(
                token_url,
                headers={"Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY},
            )
            token_resp.raise_for_status()
            access_token = token_resp.text

        # Step 2: Synthesize speech
        tts_url = f"https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
        # Truncate for TTS
        tts_text = text[:5000] if len(text) > 5000 else text
        # Escape XML special chars
        tts_text = tts_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

        ssml = (
            '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xml:lang="{language}">' 
            f'<voice name="{voice}">{tts_text}</voice></speak>'
        )

        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                tts_url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/ssml+xml",
                    "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
                },
                content=ssml.encode("utf-8"),
            )
            resp.raise_for_status()
            filepath.write_bytes(resp.content)

        return f"/static/audio/{filename}"


# Singleton
tts_service = TTSService()
