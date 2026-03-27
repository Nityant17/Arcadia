"""
Generate Service — Cheatsheets, Flashcards, and Mermaid.js Diagrams.
Uses the LLM service with specialized prompts and the RAG service for context.
"""
import re
from typing import Dict, List

from services.llm_service import llm_service
from services.rag_service import rag_service
from services.translate_service import translate_service
from services.safety_service import safety_service


class GenerateService:
    @staticmethod
    def _strip_front_matter(text: str) -> str:
        if not text:
            return ""
        patterns = [
            r"\bisbn\b",
            r"all rights reserved",
            r"\bcopyright\b",
            r"\bpublished\b",
            r"\bpublisher\b",
            r"\bedition\b",
            r"\bforeword\b",
            r"\bpreface\b",
            r"\backnowledg",
            r"\btable of contents\b",
            r"\bcontents\b",
            r"\bindex\b",
            r"\btitle page\b",
            r"\bconsulting editor\b",
        ]
        cleaned_lines = []
        for line in text.splitlines():
            lower = line.lower()
            if any(re.search(p, lower) for p in patterns):
                continue
            cleaned_lines.append(line)
        return "\n".join(cleaned_lines).strip()

    @staticmethod
    def _is_low_value_card(text: str) -> bool:
        lowered = (text or "").lower()
        blocked = [
            "author",
            "publisher",
            "published",
            "publication",
            "isbn",
            "edition",
            "copyright",
            "preface",
            "acknowledg",
            "foreword",
            "table of contents",
            "contents",
            "index",
            "title of the book",
            "book title",
            "title page",
            "consulting editor",
            "editor",
        ]
        return any(token in lowered for token in blocked)

    def _sanitize_flashcards(self, cards: list) -> list[dict]:
        cleaned: list[dict] = []
        seen: set[str] = set()
        for card in cards or []:
            front = (card.get("front") or "").strip()
            back = (card.get("back") or "").strip()
            if not front or not back:
                continue
            if self._is_low_value_card(front) or self._is_low_value_card(back):
                continue
            key = front.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append({"front": front, "back": back})
        return cleaned

    async def generate_cheatsheet(self, context_id: str,
                                   document_ids: List[str],
                                   language: str = "en",
                                   focus_topic: str = "") -> Dict:
        """Generate a one-page cheatsheet from document content."""
        focus_safety = safety_service.check_text(focus_topic)
        if not focus_safety.allowed:
            raise PermissionError(focus_safety.reason)

        if not document_ids:
            raise ValueError("No source documents found for this generation")

        if focus_topic:
            chunks = []
            for doc_id in document_ids:
                chunks.extend(rag_service.query(focus_topic, document_id=doc_id, top_k=4))
            chunks.sort(key=lambda c: c.get("distance", 1.0))
            chunks = chunks[:10]
            context = "\n\n".join(c["text"] for c in chunks) if chunks else ""
            if not context:
                context = "\n\n".join(
                    rag_service.get_document_text_with_fallback(doc_id) or ""
                    for doc_id in document_ids
                ).strip()
        else:
            context = "\n\n".join(
                rag_service.get_document_text_with_fallback(doc_id) or ""
                for doc_id in document_ids
            ).strip()
        context = self._strip_front_matter(context)
        if not context:
            raise ValueError(f"No content found for context '{context_id}'")

        # Truncate if needed
        if len(context) > 8000:
            context = context[:8000]

        context_safety = safety_service.check_text(context[:6000])
        if not context_safety.allowed:
            raise PermissionError(context_safety.reason)

        system_prompt, user_prompt = llm_service.build_cheatsheet_prompt(context, "en")
        content = await llm_service.generate(user_prompt, system_prompt, temperature=0.5)

        output_safety = safety_service.check_text(content)
        if not output_safety.allowed:
            raise PermissionError(output_safety.reason)

        # Translate to target language if not English
        if language != "en":
            try:
                content = translate_service.translate(
                    content, target_language=language, source_language="en"
                )
            except Exception:
                pass  # Keep English if translation fails

        return {
            "document_id": context_id,
            "title": f"Cheatsheet — {context_id[:8]}",
            "content": content,
            "language": language,
        }

    async def generate_flashcards(self, context_id: str,
                                   document_ids: List[str],
                                   language: str = "en",
                                   focus_topic: str = "") -> Dict:
        """Generate a set of flashcards from document content."""
        focus_safety = safety_service.check_text(focus_topic)
        if not focus_safety.allowed:
            raise PermissionError(focus_safety.reason)

        if not document_ids:
            raise ValueError("No source documents found for this generation")

        if focus_topic:
            chunks = []
            for doc_id in document_ids:
                chunks.extend(rag_service.query(focus_topic, document_id=doc_id, top_k=4))
            chunks.sort(key=lambda c: c.get("distance", 1.0))
            chunks = chunks[:8]
            context = "\n\n".join(c["text"] for c in chunks) if chunks else ""
            if not context:
                context = "\n\n".join(
                    rag_service.get_document_text_with_fallback(doc_id) or ""
                    for doc_id in document_ids
                ).strip()
        else:
            context = "\n\n".join(
                rag_service.get_document_text_with_fallback(doc_id) or ""
                for doc_id in document_ids
            ).strip()
        context = self._strip_front_matter(context)
        if not context:
            raise ValueError(f"No content found for context '{context_id}'")

        if len(context) > 6000:
            context = context[:6000]

        context_safety = safety_service.check_text(context[:6000])
        if not context_safety.allowed:
            raise PermissionError(context_safety.reason)

        processed_cards: list[dict] = []
        target_cards = 10
        for attempt in range(2):
            system_prompt, user_prompt = llm_service.build_flashcards_prompt(
                context,
                "en",
                num_cards=target_cards,
            )
            try:
                result = await llm_service.generate_json(user_prompt, system_prompt, temperature=0.4)
            except Exception:
                continue
            cards = result.get("cards", [])
            cleaned = self._sanitize_flashcards(cards)
            if len(cleaned) > len(processed_cards):
                processed_cards = cleaned
            if len(processed_cards) >= 6:
                break

        if len(processed_cards) < 8:
            missing = 8 - len(processed_cards)
            avoid_fronts = [c.get("front", "") for c in processed_cards]
            system_prompt, user_prompt = llm_service.build_flashcards_prompt(
                context,
                "en",
                num_cards=missing,
                avoid_fronts=avoid_fronts,
            )
            try:
                result = await llm_service.generate_json(user_prompt, system_prompt, temperature=0.4)
                cards = result.get("cards", [])
                cleaned = self._sanitize_flashcards(cards)
                seen = {c.get("front", "").strip().lower() for c in processed_cards}
                for card in cleaned:
                    key = card.get("front", "").strip().lower()
                    if not key or key in seen:
                        continue
                    processed_cards.append(card)
                    seen.add(key)
                    if len(processed_cards) >= 8:
                        break
            except Exception:
                pass

        merged_cards_text = "\n".join(
            f"{c.get('front', '')}\n{c.get('back', '')}" for c in processed_cards
        )
        cards_safety = safety_service.check_text(merged_cards_text[:8000])
        if not cards_safety.allowed:
            raise PermissionError(cards_safety.reason)

        # Translate cards to target language if not English
        if language != "en":
            for card in processed_cards:
                try:
                    card["front"] = translate_service.translate(
                        card["front"], target_language=language, source_language="en"
                    )
                    card["back"] = translate_service.translate(
                        card["back"], target_language=language, source_language="en"
                    )
                except Exception:
                    pass  # Keep English if translation fails

        return {
            "document_id": context_id,
            "cards": processed_cards,
            "language": language,
        }

    async def generate_diagram(self, context_id: str, document_ids: List[str]) -> Dict:
        """Generate a Mermaid.js diagram from document content."""
        if not document_ids:
            raise ValueError("No source documents found for this generation")

        context = "\n\n".join(
            rag_service.get_document_text_with_fallback(doc_id) or ""
            for doc_id in document_ids
        ).strip()
        if not context:
            raise ValueError(f"No content found for context '{context_id}'")

        if len(context) > 6000:
            context = context[:6000]

        context_safety = safety_service.check_text(context[:6000])
        if not context_safety.allowed:
            raise PermissionError(context_safety.reason)

        system_prompt, user_prompt = llm_service.build_diagram_prompt(context)

        # Try JSON parsing first; fall back to extracting mermaid code directly
        try:
            result = await llm_service.generate_json(user_prompt, system_prompt, temperature=0.3)
            mermaid_code = result.get("mermaid_code", "")
            title = result.get("title", "Concept Diagram")
        except (ValueError, Exception):
            # LLM didn't return valid JSON — extract mermaid code from raw text
            raw = await llm_service.generate(user_prompt, system_prompt, temperature=0.3)
            mermaid_code = self._extract_mermaid(raw)
            title = "Concept Diagram"

        if not mermaid_code:
            mermaid_code = "graph TD\n  A[No diagram generated]"

        diagram_safety = safety_service.check_text(mermaid_code)
        if not diagram_safety.allowed:
            raise PermissionError(diagram_safety.reason)

        return {
            "document_id": context_id,
            "mermaid_code": mermaid_code,
            "title": title,
        }

    @staticmethod
    def _extract_mermaid(text: str) -> str:
        """Extract Mermaid.js code from raw LLM output."""
        # Try ```mermaid ... ``` block
        m = re.search(r'```mermaid\s*\n(.*?)```', text, re.DOTALL)
        if m:
            return m.group(1).strip()

        # Try ``` ... ``` block that starts with graph/flowchart
        m = re.search(r'```\s*\n?((?:graph|flowchart).*?)```', text, re.DOTALL)
        if m:
            return m.group(1).strip()

        # Try finding graph TD or flowchart TD directly
        m = re.search(r'((?:graph|flowchart)\s+(?:TD|TB|LR|RL|BT)\b.*)', text, re.DOTALL)
        if m:
            # Take until the end or until a non-mermaid line
            code = m.group(1).strip()
            # Trim trailing prose (lines that don't look like mermaid)
            lines = code.split('\n')
            mermaid_lines = []
            for line in lines:
                stripped = line.strip()
                if stripped.startswith('```') and mermaid_lines:
                    break
                if not stripped:
                    mermaid_lines.append(line)
                    continue
                # Mermaid lines typically have -->, ---, :::, [], (), or start with graph/flowchart/subgraph/end/style
                if any(tok in stripped for tok in ['-->', '---', '[', '(', '|', 'subgraph', 'end', 'style', 'graph ', 'flowchart ']):
                    mermaid_lines.append(line)
                elif re.match(r'^\s*[A-Za-z0-9_]+\s*[-\[\(]', stripped):
                    mermaid_lines.append(line)
                else:
                    break
            return '\n'.join(mermaid_lines).strip()

        return ""


# Singleton
generate_service = GenerateService()
