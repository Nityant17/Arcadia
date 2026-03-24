"""
Safety Service — lightweight responsible AI guardrails.
Blocks harmful upload content and harmful user prompts.
"""
import os
import re
from pathlib import Path
from dataclasses import dataclass
from typing import List

import httpx

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

try:
    from transformers import pipeline
except Exception:  # pragma: no cover
    pipeline = None


@dataclass
class SafetyCheckResult:
    allowed: bool
    reason: str = ""
    categories: List[str] = None


class SafetyService:
    def __init__(self):
        sexual_patterns = [
            r"\bexplicit\b", r"\bporn\b", r"\bsexual\b", r"\badult content\b",
            r"\bnude\b", r"\b18\+\b", r"\berotic\b", r"\bxxx\b",
        ]
        violence_patterns = [
            r"\bbomb\b", r"\bexplosive\b", r"\bdetonator\b", r"\bgunpowder\b",
            r"\bweapon\b", r"\battack\b", r"\bkill\b", r"\bhow to make\s+a\s+bomb\b",
        ]
        self._sexual = [re.compile(p, re.IGNORECASE) for p in sexual_patterns]
        self._violence = [re.compile(p, re.IGNORECASE) for p in violence_patterns]
        self._hf_image_model = os.getenv("ARCADIA_IMAGE_MODERATION_MODEL", "Falconsai/nsfw_image_detection")
        self._hf_api_token = os.getenv("HUGGINGFACEHUB_API_TOKEN", "")
        self._image_moderation_enabled = os.getenv("ARCADIA_IMAGE_MODERATION_ENABLED", "true").lower() == "true"
        self._image_moderation_fail_closed = os.getenv("ARCADIA_IMAGE_MODERATION_FAIL_CLOSED", "true").lower() == "true"
        self._image_classifier = None
        self._image_classifier_attempted = False

    def _blocked_categories(self, text: str) -> List[str]:
        categories = []

        for patt in self._sexual:
            if patt.search(text):
                categories.append("sexual")
                break

        for patt in self._violence:
            if patt.search(text):
                categories.append("harmful_instructions")
                break

        return categories

    def check_text(self, text: str) -> SafetyCheckResult:
        if not text:
            return SafetyCheckResult(allowed=True, categories=[])

        categories = self._blocked_categories(text)

        if categories:
            if "harmful_instructions" in categories:
                return SafetyCheckResult(
                    allowed=False,
                    reason="This content appears to request or include harmful instructions. Arcadia blocks unsafe guidance.",
                    categories=categories,
                )
            return SafetyCheckResult(
                allowed=False,
                reason="This content appears to include adult or explicit material, which Arcadia does not process.",
                categories=categories,
            )

        return SafetyCheckResult(allowed=True, categories=[])

    def _get_local_image_classifier(self):
        if self._image_classifier_attempted:
            return self._image_classifier

        self._image_classifier_attempted = True
        if pipeline is None:
            return None

        try:
            self._image_classifier = pipeline(
                "image-classification",
                model=self._hf_image_model,
                top_k=5,
            )
        except Exception:
            self._image_classifier = None

        return self._image_classifier

    @staticmethod
    def _is_nsfw_prediction(label: str) -> bool:
        normalized = (label or "").strip().lower()
        return any(tok in normalized for tok in ["nsfw", "porn", "sexual", "hentai", "explicit", "adult"])

    def _evaluate_image_predictions(self, predictions) -> SafetyCheckResult:
        if not predictions:
            return SafetyCheckResult(allowed=True, categories=[])

        max_nsfw = 0.0
        for pred in predictions:
            label = (pred.get("label") or pred.get("class") or "").strip()
            score = float(pred.get("score", 0.0) or 0.0)
            if self._is_nsfw_prediction(label):
                max_nsfw = max(max_nsfw, score)

        if max_nsfw >= 0.35:
            return SafetyCheckResult(
                allowed=False,
                reason="This image appears to contain adult/explicit content, which Arcadia does not accept.",
                categories=["sexual"],
            )

        return SafetyCheckResult(allowed=True, categories=[])

    def _classify_image_with_hf_api(self, image_path: str):
        if not self._hf_api_token:
            return None

        endpoint = f"https://api-inference.huggingface.co/models/{self._hf_image_model}"
        headers = {
            "Authorization": f"Bearer {self._hf_api_token}",
            "Content-Type": "application/octet-stream",
        }

        try:
            with open(image_path, "rb") as image_file:
                image_bytes = image_file.read()

            response = httpx.post(endpoint, headers=headers, content=image_bytes, timeout=25.0)
            if response.status_code >= 400:
                return None

            payload = response.json()
            if isinstance(payload, list):
                return payload
            return None
        except Exception:
            return None

    def _classify_image_local(self, image_path: str):
        classifier = self._get_local_image_classifier()
        if classifier is None or Image is None:
            return None

        try:
            with Image.open(image_path) as image:
                image = image.convert("RGB")
                return classifier(image)
        except Exception:
            return None

    def check_image_file(self, image_path: str) -> SafetyCheckResult:
        if not self._image_moderation_enabled:
            return SafetyCheckResult(allowed=True, categories=[])

        suffix = Path(image_path).suffix.lower()
        if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}:
            return SafetyCheckResult(allowed=True, categories=[])

        predictions = self._classify_image_with_hf_api(image_path)
        if predictions is None:
            predictions = self._classify_image_local(image_path)

        if predictions is None:
            if self._image_moderation_fail_closed:
                return SafetyCheckResult(
                    allowed=False,
                    reason=(
                        "Image moderation is not available right now. "
                        "Configure HUGGINGFACEHUB_API_TOKEN or install local moderation dependencies."
                    ),
                    categories=["moderation_unavailable"],
                )
            return SafetyCheckResult(allowed=True, categories=[])

        return self._evaluate_image_predictions(predictions)


safety_service = SafetyService()
