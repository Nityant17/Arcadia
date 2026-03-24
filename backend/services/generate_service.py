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

    async def generate_cheatsheet(self, document_id: str, 
                                   language: str = "en",
                                   focus_topic: str = "") -> Dict:
        """Generate a one-page cheatsheet from document content."""
        focus_safety = safety_service.check_text(focus_topic)
        if not focus_safety.allowed:
            raise PermissionError(focus_safety.reason)

        if focus_topic:
            chunks = rag_service.query(focus_topic, document_id=document_id, top_k=10)
            context = "\n\n".join(c["text"] for c in chunks) if chunks else ""
            if not context:
                context = rag_service.get_document_text_with_fallback(document_id) or ""
        else:
            context = rag_service.get_document_text_with_fallback(document_id)
        if not context:
            raise ValueError(f"No content found for document '{document_id}'")

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
            "document_id": document_id,
            "title": f"Cheatsheet — {document_id[:8]}",
            "content": content,
            "language": language,
        }

    async def generate_flashcards(self, document_id: str,
                                   language: str = "en",
                                   focus_topic: str = "") -> Dict:
        """Generate a set of flashcards from document content."""
        focus_safety = safety_service.check_text(focus_topic)
        if not focus_safety.allowed:
            raise PermissionError(focus_safety.reason)

        if focus_topic:
            chunks = rag_service.query(focus_topic, document_id=document_id, top_k=8)
            context = "\n\n".join(c["text"] for c in chunks) if chunks else ""
            if not context:
                context = rag_service.get_document_text_with_fallback(document_id) or ""
        else:
            context = rag_service.get_document_text_with_fallback(document_id)
        if not context:
            raise ValueError(f"No content found for document '{document_id}'")

        if len(context) > 6000:
            context = context[:6000]

        context_safety = safety_service.check_text(context[:6000])
        if not context_safety.allowed:
            raise PermissionError(context_safety.reason)

        system_prompt, user_prompt = llm_service.build_flashcards_prompt(context, "en")
        result = await llm_service.generate_json(user_prompt, system_prompt, temperature=0.4)

        cards = result.get("cards", [])
        processed_cards = [{"front": c.get("front", ""), "back": c.get("back", "")} for c in cards]

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
            "document_id": document_id,
            "cards": processed_cards,
            "language": language,
        }

    async def generate_diagram(self, document_id: str) -> Dict:
        """Generate a Mermaid.js diagram from document content."""
        context = rag_service.get_document_text_with_fallback(document_id)
        if not context:
            raise ValueError(f"No content found for document '{document_id}'")

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
            "document_id": document_id,
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
