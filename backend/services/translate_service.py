"""
Translation Service.
Local: deep-translator (uses Google Translate API, free tier)
Azure: Azure AI Translator
"""
import httpx
from deep_translator import GoogleTranslator

from config import (
    MODE, SUPPORTED_LANGUAGES,
    AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION,
)


class TranslateService:

    def translate(self, text: str, target_language: str = "hi",
                  source_language: str = "auto") -> str:
        """Translate text to the target language."""
        if target_language == source_language:
            return text
        if target_language == "en" and source_language == "auto":
            # Might already be English
            pass

        if MODE == "azure":
            print(f"[TRANSLATE] Using AZURE Translator — {source_language} → {target_language}")
            return self._azure_translate(text, target_language, source_language)
        print(f"[TRANSLATE] Using LOCAL deep-translator — {source_language} → {target_language}")
        return self._local_translate(text, target_language, source_language)

    def _local_translate(self, text: str, target: str, source: str) -> str:
        """Use deep-translator (Google Translate backend)."""
        try:
            # Handle long text by splitting into chunks
            max_chars = 4500  # Google Translate limit per request
            if len(text) <= max_chars:
                translator = GoogleTranslator(source=source, target=target)
                return translator.translate(text)

            # Split by paragraphs for long text
            paragraphs = text.split('\n')
            translated_parts = []
            current_chunk = ""

            for para in paragraphs:
                if len(current_chunk) + len(para) < max_chars:
                    current_chunk += para + "\n"
                else:
                    if current_chunk.strip():
                        translator = GoogleTranslator(source=source, target=target)
                        translated_parts.append(translator.translate(current_chunk.strip()))
                    current_chunk = para + "\n"

            if current_chunk.strip():
                translator = GoogleTranslator(source=source, target=target)
                translated_parts.append(translator.translate(current_chunk.strip()))

            return "\n".join(translated_parts)

        except Exception as e:
            print(f"Translation error: {e}")
            return text  # Return original on failure

    def _azure_translate(self, text: str, target: str, source: str) -> str:
        """Azure AI Translator via REST API."""
        import uuid as _uuid

        url = "https://api.cognitive.microsofttranslator.com/translate"
        params = {"api-version": "3.0", "to": target}
        if source and source != "auto":
            params["from"] = source

        headers = {
            "Ocp-Apim-Subscription-Key": AZURE_TRANSLATOR_KEY,
            "Ocp-Apim-Subscription-Region": AZURE_TRANSLATOR_REGION,
            "Content-Type": "application/json",
            "X-ClientTraceId": str(_uuid.uuid4()),
        }

        # Azure Translator has a 50 000 char limit per request
        max_chars = 49000
        if len(text) <= max_chars:
            body = [{"Text": text}]
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, params=params, headers=headers, json=body)
                resp.raise_for_status()
                data = resp.json()
                return data[0]["translations"][0]["text"]

        # Split long text into chunks
        paragraphs = text.split("\n")
        translated_parts = []
        current_chunk = ""
        for para in paragraphs:
            if len(current_chunk) + len(para) < max_chars:
                current_chunk += para + "\n"
            else:
                if current_chunk.strip():
                    body = [{"Text": current_chunk.strip()}]
                    with httpx.Client(timeout=30.0) as client:
                        resp = client.post(url, params=params, headers=headers, json=body)
                        resp.raise_for_status()
                        data = resp.json()
                        translated_parts.append(data[0]["translations"][0]["text"])
                current_chunk = para + "\n"
        if current_chunk.strip():
            body = [{"Text": current_chunk.strip()}]
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, params=params, headers=headers, json=body)
                resp.raise_for_status()
                data = resp.json()
                translated_parts.append(data[0]["translations"][0]["text"])

        return "\n".join(translated_parts)

    def get_supported_languages(self) -> dict:
        return SUPPORTED_LANGUAGES


# Singleton
translate_service = TranslateService()
