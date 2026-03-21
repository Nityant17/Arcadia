"""
Safety Service — lightweight responsible AI guardrails.
Blocks harmful upload content and harmful user prompts.
"""
import re
from dataclasses import dataclass
from typing import List


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

    def check_text(self, text: str) -> SafetyCheckResult:
        if not text:
            return SafetyCheckResult(allowed=True, categories=[])

        categories = []
        for patt in self._sexual:
            if patt.search(text):
                categories.append("sexual")
                break

        for patt in self._violence:
            if patt.search(text):
                categories.append("harmful_instructions")
                break

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


safety_service = SafetyService()
