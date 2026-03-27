"""
LLM Service — Abstraction over Ollama (local) and Azure OpenAI.
Handles all text generation: chat, quiz, cheatsheets, flashcards, diagrams.
"""
import json
import httpx
from typing import List, Dict, Optional, AsyncGenerator

from config import (
    MODE, OLLAMA_BASE_URL, OLLAMA_MODEL,
    AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY,
    AZURE_OPENAI_DEPLOYMENT,
)


class LLMService:
    """Unified interface for LLM generation."""

    def __init__(self):
        self.base_url = OLLAMA_BASE_URL
        self.model = OLLAMA_MODEL

    # ─── Core Generation ──────────────────────────────────────

    async def generate(self, prompt: str, system_prompt: str = "",
                       temperature: float = 0.7, max_tokens: int = 2048) -> str:
        """Generate a completion from the LLM."""
        if MODE == "azure":
            print(f"[LLM] Using AZURE OpenAI — deployment: {AZURE_OPENAI_DEPLOYMENT}")
            return await self._azure_generate(prompt, system_prompt, temperature, max_tokens)
        print(f"[LLM] Using LOCAL Ollama — model: {self.model}")
        return await self._ollama_generate(prompt, system_prompt, temperature, max_tokens)

    async def generate_json(self, prompt: str, system_prompt: str = "",
                            temperature: float = 0.3) -> dict:
        """Generate and parse a JSON response from the LLM."""
        raw = await self.generate(prompt, system_prompt, temperature)
        return self._parse_json(raw)

    # ─── Ollama Implementation ────────────────────────────────

    async def _ollama_generate(self, prompt: str, system_prompt: str,
                                temperature: float, max_tokens: int) -> str:
        """Call Ollama's /api/generate endpoint."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                resp = await client.post(f"{self.base_url}/api/generate", json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data.get("response", "").strip()
            except httpx.ConnectError:
                raise ConnectionError(
                    "Cannot connect to Ollama. Is it running? "
                    "Start it with: ollama serve"
                )
            except Exception as e:
                raise RuntimeError(f"Ollama generation failed: {e}")

    async def stream_generate(self, prompt: str, 
                               system_prompt: str = "") -> AsyncGenerator[str, None]:
        """Stream tokens from Ollama for real-time chat."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
            "options": {"temperature": 0.7},
        }
        if system_prompt:
            payload["system"] = system_prompt

        if MODE == "azure":
            # Azure OpenAI streaming
            url = (
                f"{AZURE_OPENAI_ENDPOINT.rstrip('/')}/openai/deployments/"
                f"{AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-06-01"
            )
            headers = {"Content-Type": "application/json", "api-key": AZURE_OPENAI_KEY}
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            az_payload = {"messages": messages, "temperature": 0.7, "stream": True}
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, headers=headers, json=az_payload) as resp:
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                delta = data["choices"][0].get("delta", {})
                                token = delta.get("content", "")
                                if token:
                                    yield token
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue
            return

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", f"{self.base_url}/api/generate",
                                      json=payload) as resp:
                async for line in resp.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            token = data.get("response", "")
                            if token:
                                yield token
                            if data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue

    # ─── Azure (placeholder) ──────────────────────────────────

    async def _azure_generate(self, prompt: str, system_prompt: str,
                               temperature: float, max_tokens: int) -> str:
        """Azure OpenAI Chat Completions via REST API."""
        url = (
            f"{AZURE_OPENAI_ENDPOINT.rstrip('/')}/openai/deployments/"
            f"{AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-06-01"
        )
        headers = {
            "Content-Type": "application/json",
            "api-key": AZURE_OPENAI_KEY,
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            except httpx.HTTPStatusError as e:
                raise RuntimeError(
                    f"Azure OpenAI error {e.response.status_code}: {e.response.text}"
                )
            except Exception as e:
                raise RuntimeError(f"Azure OpenAI generation failed: {e}")

    # ─── Helpers ──────────────────────────────────────────────

    @staticmethod
    def _parse_json(text: str) -> dict:
        """Extract JSON from LLM output (handles markdown code blocks)."""
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from ```json ... ``` block
        import re
        json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try finding first { ... } or [ ... ]
        for start_char, end_char in [('{', '}'), ('[', ']')]:
            start = text.find(start_char)
            end = text.rfind(end_char)
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start:end + 1])
                except json.JSONDecodeError:
                    pass

        raise ValueError(f"Could not parse JSON from LLM output: {text[:200]}")

    # ─── Prompt Builders ──────────────────────────────────────

    def build_rag_prompt(self, query: str, context_chunks: List[Dict],
                         language: str = "en") -> tuple:
        """Build a RAG chat prompt with retrieved context."""
        context_text = "\n\n---\n\n".join([c["text"] for c in context_chunks])

        lang_instruction = ""
        if language != "en":
            lang_names = {
                "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "mr": "Marathi",
                "bn": "Bengali", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam"
            }
            lang_name = lang_names.get(language, language)
            lang_instruction = f"\n\nIMPORTANT: Respond in {lang_name}. Use the {lang_name} script."

        system_prompt = (
            "You are Arcadia, an AI study assistant. You help students understand "
            "concepts from their uploaded notes. Answer questions accurately based on "
            "the provided context. If the context doesn't contain enough information, "
            "say so clearly. Use clear explanations, examples, and analogies. "
            "Format your response with proper markdown."
            f"{lang_instruction}"
        )

        user_prompt = (
            f"## Student's Notes (Context)\n\n{context_text}\n\n"
            f"---\n\n## Student's Question\n\n{query}\n\n"
            f"Answer based on the notes above. Be clear, concise, and educational."
        )

        return system_prompt, user_prompt

    def build_quiz_prompt(self, context: str, tier: int,
                          num_questions: int, language: str = "en",
                          strict: bool = False,
                          avoid_questions: list[str] | None = None) -> tuple:
        """Build a prompt to generate quiz questions."""
        tier_descriptions = {
            1: "Tier 1 — RECALL: Test basic definitions, facts, and key terms. "
               "Questions should be straightforward recall from the notes.",
            2: "Tier 2 — APPLICATION: Test the ability to apply concepts to solve "
               "problems. Include scenario-based and calculation questions.",
            3: "Tier 3 — ANALYSIS: Test higher-order thinking — evaluation, comparison, "
               "synthesis, and critical analysis of concepts.",
        }

        lang_instruction = ""
        if language != "en":
            lang_instruction = f"\nGenerate all questions and options in the language with code: {language}."

        strict_note = (
            "Double-check every question for correctness, uniqueness, and exactly 4 options. "
            "If any question violates the rules, replace it with a better one."
        ) if strict else ""

        avoid_block = ""
        if avoid_questions:
            trimmed = [q.strip() for q in avoid_questions if q and q.strip()]
            if trimmed:
                avoid_list = "\n".join(f"- {q}" for q in trimmed[:12])
                avoid_block = (
                    "\nAvoid repeating these questions:\n"
                    f"{avoid_list}\n"
                )

        system_prompt = (
            "You are an expert quiz generator for educational assessments. "
            "Generate high-quality multiple-choice questions based on the given study material. "
            "Each question must have exactly 4 options with only one correct answer. "
            "Avoid trivial or meta questions (author, publisher, edition, ISBN, acknowledgements, "
            "table of contents, foreword, index, or credits) unless the study material is explicitly about them. "
            "Avoid 'All of the above' or 'None of the above'. "
            f"{strict_note}"
        )

        user_prompt = (
            f"## Study Material\n\n{context}\n\n"
            f"---\n\n"
            f"## Quiz Requirements\n\n"
            f"Difficulty Level: {tier_descriptions[tier]}\n"
            f"Number of questions: {num_questions}\n"
            f"{lang_instruction}\n\n"
            f"Quality Rules:\n"
            f"- Use only core learning content, ignore front-matter and metadata.\n"
            f"- Make options plausible and mutually exclusive.\n"
            f"- Keep wording concise and unambiguous.\n"
            f"- Ensure Tier 1 = recall, Tier 2 = apply, Tier 3 = analyze/compare/evaluate.\n\n"
            f"{avoid_block}\n"
            f"## Output Format\n\n"
            f"Respond ONLY with valid JSON in this exact format:\n"
            f'{{"questions": [\n'
            f'  {{\n'
            f'    "question": "What is ...?",\n'
            f'    "options": ["Option A", "Option B", "Option C", "Option D"],\n'
            f'    "correct_option": 0,\n'
            f'    "explanation": "Brief explanation of why the answer is correct"\n'
            f'  }}\n'
            f']}}\n\n'
            f"correct_option is a 0-based index (0=A, 1=B, 2=C, 3=D)."
        )

        return system_prompt, user_prompt

    def build_cheatsheet_prompt(self, context: str, language: str = "en") -> tuple:
        """Build prompt for cheatsheet generation."""
        lang_instruction = ""
        if language != "en":
            lang_instruction = f"\nGenerate the cheatsheet in the language with code: {language}."

        system_prompt = (
            "You are an expert at creating concise, well-organized study cheatsheets. "
            "Create a one-page cheatsheet from the study material. "
            "Ignore front-matter and metadata (title pages, author lists, ISBN, publisher info)."
        )

        user_prompt = (
            f"## Study Material\n\n{context}\n\n---\n\n"
            f"Create a concise ONE-PAGE CHEATSHEET in Markdown format. Include:\n"
            f"- **Title** at the top\n"
            f"- **Key Concepts** with brief definitions\n"
            f"- **Important Formulas** (if applicable)\n"
            f"- **Key Points** as bullet points\n"
            f"- **Quick Summary** (2-3 sentences)\n"
            f"- **Common Mistakes to Avoid**\n"
            f"{lang_instruction}\n\n"
            f"Keep it concise and exam-ready. Use proper markdown formatting."
        )

        return system_prompt, user_prompt

    def build_flashcards_prompt(
        self,
        context: str,
        language: str = "en",
        num_cards: int = 10,
        avoid_fronts: list[str] | None = None,
    ) -> tuple:
        """Build prompt for flashcard generation."""
        lang_instruction = ""
        if language != "en":
            lang_instruction = f"\nGenerate in the language with code: {language}."

        system_prompt = (
            "You are an expert at creating educational flashcards for spaced "
            "repetition study. Generate flashcards from the given study material. "
            "Avoid trivial or metadata-based cards (author, publisher, ISBN, acknowledgements)."
        )

        avoid_block = ""
        if avoid_fronts:
            trimmed = [q.strip() for q in avoid_fronts if q and q.strip()]
            if trimmed:
                avoid_list = "\n".join(f"- {q}" for q in trimmed[:12])
                avoid_block = (
                    "\nAvoid repeating these fronts:\n"
                    f"{avoid_list}\n"
                )

        user_prompt = (
            f"## Study Material\n\n{context}\n\n---\n\n"
            f"Generate {max(6, num_cards)} flashcards. Each card has a FRONT (question/term) "
            f"and BACK (answer/definition).\n"
            f"{lang_instruction}\n\n"
            f"{avoid_block}\n"
            f"Respond ONLY with valid JSON:\n"
            f'{{"cards": [\n'
            f'  {{"front": "What is ...?", "back": "It is ..."}}\n'
            f']}}'
        )

        return system_prompt, user_prompt

    def build_diagram_prompt(self, context: str) -> tuple:
        """Build prompt for Mermaid.js diagram generation."""
        system_prompt = (
            "You output ONLY raw JSON. No markdown, no explanation, no commentary. "
            "Just a single JSON object."
        )

        user_prompt = (
            f"Study material:\n{context}\n\n"
            f"Create a Mermaid.js flowchart (graph TD) that visualizes the key concepts "
            f"and relationships from this material.\n\n"
            f"OUTPUT INSTRUCTIONS: Return ONLY this JSON, nothing else:\n"
            f'{{"title": "Your Title Here", "mermaid_code": "graph TD\\n  A[Concept] --> B[Concept]"}}\n\n'
            f"Rules:\n"
            f"- Use graph TD (top-down flowchart)\n"
            f"- Use simple node IDs like A, B, C\n"
            f"- Put labels in square brackets: A[Label]\n"
            f"- Use --> for arrows\n"
            f"- Use \\n for newlines inside the mermaid_code string\n"
            f"- NO explanation, NO markdown fences, ONLY the JSON object"
        )

        return system_prompt, user_prompt

    def build_topics_prompt(self, context: str) -> tuple:
        """Build prompt to extract chapters/topics from a document."""
        system_prompt = (
            "You output ONLY raw JSON. No markdown, no explanation, no commentary. "
            "Just a single JSON object."
        )

        user_prompt = (
            f"Study material:\n{context}\n\n"
            f"Analyze this document and identify the main chapters, sections, or topics covered.\n\n"
            f"OUTPUT INSTRUCTIONS: Return ONLY this JSON:\n"
            f'{{"topics": [\n'
            f'  {{"title": "Topic Name", "summary": "Brief one-line summary"}}\n'
            f']}}\n\n'
            f"Rules:\n"
            f"- Identify 3-10 distinct topics/chapters/sections\n"
            f"- Use clear, concise titles\n"
            f"- If the document has a table of contents or index, use those headings\n"
            f"- If no clear structure, identify the main themes/concepts\n"
            f"- Ignore front-matter and metadata (author lists, ISBN, publisher info)\n"
            f"- NO explanation, ONLY the JSON object"
        )

        return system_prompt, user_prompt

    def build_topics_prompt(self, context: str) -> tuple:
        """Build prompt to extract chapters/topics from document text."""
        system_prompt = (
            "You output ONLY raw JSON. No markdown, no explanation, no commentary. "
            "Just a single JSON object."
        )

        user_prompt = (
            f"Study material:\n{context}\n\n"
            f"Identify the main chapters, topics, or sections from this study material.\n\n"
            f"OUTPUT INSTRUCTIONS: Return ONLY this JSON, nothing else:\n"
            f'{{"topics": [\n'
            f'  {{"title": "Topic Name", "summary": "Brief 1-sentence description"}}\n'
            f"]}}\n\n"
            f"Rules:\n"
            f"- Extract 3-10 distinct topics/chapters\n"
            f"- Focus on main headings and core subject areas\n"
            f"- If the material has a table of contents or index, use those headings\n"
            f"- If it's a single topic document, break it into logical subtopics\n"
            f"- Keep summaries concise (1 short sentence)\n"
            f"- Ignore front-matter and metadata (author lists, ISBN, publisher info)\n"
            f"- NO explanation, NO markdown fences, ONLY the JSON object"
        )

        return system_prompt, user_prompt


# Singleton
llm_service = LLMService()
