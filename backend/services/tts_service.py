"""
TTS Service — Text-to-Speech.
Local: gTTS (Google Text-to-Speech, free)
Azure: Azure AI Speech (Neural TTS with Indic voices)
"""
import hashlib
import re
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

    @staticmethod
    def _strip_markdown_for_tts(text: str) -> str:
        """Convert markdown-rich content into plain readable text for TTS."""
        if not text:
            return ""

        cleaned = text.replace("\r\n", "\n").replace("\r", "\n")

        # Keep visible labels/content while removing markdown syntax.
        cleaned = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", cleaned)  # images
        cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)  # links
        cleaned = re.sub(r"`{3,}[\w-]*\n?", "", cleaned)  # fenced code open/close
        cleaned = cleaned.replace("`", "")  # inline code
        cleaned = re.sub(r"^>\s?", "", cleaned, flags=re.MULTILINE)  # block quotes
        cleaned = re.sub(r"^\s{0,3}#{1,6}\s*", "", cleaned, flags=re.MULTILINE)  # headings
        cleaned = re.sub(r"^\s*[-*+]\s+", "", cleaned, flags=re.MULTILINE)  # unordered lists
        cleaned = re.sub(r"^\s*\d+\.\s+", "", cleaned, flags=re.MULTILINE)  # ordered lists
        cleaned = re.sub(r"(\*\*|__)(.*?)\1", r"\2", cleaned)  # bold
        cleaned = re.sub(r"(\*|_)(.*?)\1", r"\2", cleaned)  # italics
        cleaned = re.sub(r"~~(.*?)~~", r"\1", cleaned)  # strikethrough
        cleaned = re.sub(r"<[^>]+>", "", cleaned)  # html tags
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

        return cleaned.strip()

    def synthesize(self, text: str, language: str = "en") -> tuple[bytes, str]:
        """
        Convert text to speech and return (audio_bytes, media_type).
        """
        clean_text = self._strip_markdown_for_tts(text)
        if not clean_text:
            raise ValueError("No readable text after markdown sanitization.")

        if MODE == "azure":
            print(f"[TTS] Using AZURE Speech — region: {AZURE_SPEECH_REGION}, lang: {language}")
            return self._azure_tts(clean_text, language)
        print(f"[TTS] Using LOCAL gTTS — lang: {language}")
        return self._local_tts(clean_text, language)

    def _local_tts(self, text: str, language: str) -> tuple[bytes, str]:
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

        return filepath.read_bytes(), "audio/mpeg"

    def _azure_tts(self, text: str, language: str) -> tuple[bytes, str]:
        """Azure AI Speech with neural voices via REST API."""
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
            return filepath.read_bytes(), "audio/mpeg"

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

        return filepath.read_bytes(), "audio/mpeg"


# Singleton
tts_service = TTSService()
