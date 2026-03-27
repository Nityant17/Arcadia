"""
Quiz Engine — 3-tier adaptive quizzing with mastery tracking.
Tier 1: Recall (definitions, facts)
Tier 2: Application (problem-solving, scenarios)
Tier 3: Analysis (evaluation, synthesis, critical thinking)
"""
import uuid
import datetime
from typing import List, Dict, Optional

from models.database import SessionLocal, QuizAttempt, MasteryScore, Document, Note, WeakTopic
from services.llm_service import llm_service
from services.rag_service import rag_service
from services.translate_service import translate_service
from services.safety_service import safety_service
from config import MASTERY_THRESHOLD_TIER2, MASTERY_THRESHOLD_TIER3, QUIZ_QUESTIONS_PER_TIER


class QuizService:
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
        import re
        cleaned_lines = []
        for line in text.splitlines():
            lower = line.lower()
            if any(re.search(p, lower) for p in patterns):
                continue
            cleaned_lines.append(line)
        return "\n".join(cleaned_lines).strip()

    @staticmethod
    def _is_low_value_question(text: str) -> bool:
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

    @staticmethod
    def _normalize_options(options: list) -> list[str] | None:
        if not isinstance(options, list):
            return None
        cleaned: list[str] = []
        seen: set[str] = set()
        for opt in options:
            if not isinstance(opt, str):
                continue
            value = opt.strip()
            if not value:
                continue
            key = value.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(value)
        if len(cleaned) < 4:
            return None
        return cleaned[:4]

    def _sanitize_questions(self, questions: list, num_questions: int) -> list[dict]:
        cleaned: list[dict] = []
        for q in questions or []:
            question_text = (q.get("question") or "").strip()
            if not question_text or len(question_text) < 8:
                continue
            if self._is_low_value_question(question_text):
                continue
            options = self._normalize_options(q.get("options", []))
            if not options:
                continue
            correct_option = q.get("correct_option", 0)
            if not isinstance(correct_option, int) or not 0 <= correct_option <= 3:
                continue
            cleaned.append({
                "question": question_text,
                "options": options,
                "correct_option": correct_option,
                "explanation": (q.get("explanation") or "").strip(),
            })
            if len(cleaned) >= num_questions:
                break
        return cleaned

    async def generate_quiz(self, context_id: str, document_ids: List[str], tier: int = 1,
                            num_questions: int = QUIZ_QUESTIONS_PER_TIER,
                            language: str = "en", focus_topic: str = "") -> Dict:
        """Generate quiz questions from a document's content."""
        focus_safety = safety_service.check_text(focus_topic)
        if not focus_safety.allowed:
            raise PermissionError(focus_safety.reason)

        # 1. Get document context
        if not document_ids:
            raise ValueError("No source documents found for this quiz")

        if focus_topic:
            chunks = []
            for doc_id in document_ids:
                chunks.extend(rag_service.query(focus_topic, document_id=doc_id, top_k=5))
            chunks.sort(key=lambda c: c.get("distance", 1.0))
            chunks = chunks[:10]
            context = "\n\n".join(c["text"] for c in chunks) if chunks else ""
            if not context:
                context = "\n\n".join(
                    rag_service.get_document_text(doc_id) or ""
                    for doc_id in document_ids
                ).strip()
        else:
            context = "\n\n".join(
                rag_service.get_document_text(doc_id) or ""
                for doc_id in document_ids
            ).strip()
        context = self._strip_front_matter(context)
        if not context:
            raise ValueError(f"No content found for context '{context_id}'")

        # Truncate context if too long (LLM context window)
        max_context_chars = 6000
        if len(context) > max_context_chars:
            context = context[:max_context_chars]

        context_safety = safety_service.check_text(context[:6000])
        if not context_safety.allowed:
            raise PermissionError(context_safety.reason)

        # 2. Generate questions via LLM (always in English for reliability)
        best_questions: list[dict] = []
        for attempt in range(2):
            system_prompt, user_prompt = llm_service.build_quiz_prompt(
                context, tier, num_questions, "en", strict=attempt > 0
            )
            try:
                result = await llm_service.generate_json(user_prompt, system_prompt, temperature=0.4)
            except Exception:
                continue
            questions = result.get("questions", [])
            cleaned = self._sanitize_questions(questions, num_questions)
            if len(cleaned) > len(best_questions):
                best_questions = cleaned
            if len(cleaned) >= max(1, num_questions):
                break

        if not best_questions:
            raise ValueError("LLM returned no usable questions")

        if len(best_questions) < num_questions:
            missing = num_questions - len(best_questions)
            avoid_questions = [q.get("question", "") for q in best_questions]
            system_prompt, user_prompt = llm_service.build_quiz_prompt(
                context, tier, missing, "en", strict=True, avoid_questions=avoid_questions
            )
            try:
                result = await llm_service.generate_json(user_prompt, system_prompt, temperature=0.4)
                cleaned = self._sanitize_questions(result.get("questions", []), missing)
                seen = {q.get("question", "").strip().lower() for q in best_questions}
                for q in cleaned:
                    key = q.get("question", "").strip().lower()
                    if key in seen or not key:
                        continue
                    best_questions.append(q)
                    seen.add(key)
                    if len(best_questions) >= num_questions:
                        break
            except Exception:
                pass

        generated_bundle = "\n".join(
            f"{q.get('question', '')}\n{' '.join(q.get('options', []))}\n{q.get('explanation', '')}"
            for q in best_questions
        )
        generated_safety = safety_service.check_text(generated_bundle[:9000])
        if not generated_safety.allowed:
            raise PermissionError(generated_safety.reason)

        quiz_id = str(uuid.uuid4())

        formatted_questions = []
        for i, q in enumerate(best_questions[:num_questions]):
            question_text = q.get("question", "")
            options = q.get("options", [])
            explanation = q.get("explanation", "")

            # Translate to target language if not English
            if language != "en":
                try:
                    question_text = translate_service.translate(
                        question_text, target_language=language, source_language="en"
                    )
                    options = [
                        translate_service.translate(opt, target_language=language, source_language="en")
                        for opt in options
                    ]
                    if explanation:
                        explanation = translate_service.translate(
                            explanation, target_language=language, source_language="en"
                        )
                except Exception:
                    pass  # Keep English if translation fails

            formatted_questions.append({
                "id": i,
                "question": question_text,
                "options": options,
                "correct_option": q.get("correct_option", 0),
                "explanation": explanation,
                "tier": tier,
            })

        return {
            "quiz_id": quiz_id,
            "document_id": context_id,
            "note_id": context_id,
            "document_ids": document_ids,
            "context_id": context_id,
            "tier": tier,
            "questions": formatted_questions,
        }

    def submit_quiz(self, quiz_id: str, context_id: str,
                    questions: List[Dict], answers: List[Dict], user_id: str = "guest") -> Dict:
        """Score a quiz attempt and update mastery."""
        # Build answer lookup
        answer_map = {a["question_id"]: a["selected_option"] for a in answers}

        results = []
        correct_count = 0
        tier = questions[0]["tier"] if questions else 1

        for q in questions:
            selected = answer_map.get(q["id"], -1)
            is_correct = selected == q["correct_option"]
            if is_correct:
                correct_count += 1

            results.append({
                "question_id": q["id"],
                "question": q["question"],
                "selected_option": selected,
                "correct_option": q["correct_option"],
                "is_correct": is_correct,
                "explanation": q.get("explanation", ""),
            })

        total = len(questions)
        score = correct_count / total if total > 0 else 0.0

        # Save to database
        db = SessionLocal()
        try:
            attempt = QuizAttempt(
                id=quiz_id,
                user_id=user_id,
                document_id=context_id,
                tier=tier,
                total_questions=total,
                correct_answers=correct_count,
                score=score,
                questions_json=results,
            )
            db.add(attempt)

            # Update mastery score
            mastery = (
                db.query(MasteryScore)
                .filter(MasteryScore.document_id == context_id)
                .filter(MasteryScore.user_id == user_id)
                .first()
            )

            if not mastery:
                # Look up document or note name for a human-readable topic label
                doc = (
                    db.query(Document)
                    .filter(Document.id == context_id)
                    .filter(Document.user_id == user_id)
                    .first()
                )
                if doc:
                    doc_topic = doc.original_name.rsplit('.', 1)[0]
                else:
                    note = (
                        db.query(Note)
                        .filter(Note.id == context_id)
                        .filter(Note.user_id == user_id)
                        .first()
                    )
                    doc_topic = note.title if note else context_id[:8]
                mastery = MasteryScore(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    document_id=context_id,
                    topic=doc_topic,
                    mastery_score=0.0,
                    tier_unlocked=1,
                    total_attempts=0,
                )
                db.add(mastery)

            mastery.total_attempts += 1
            mastery.last_studied = datetime.datetime.utcnow()

            # Compute new mastery score (weighted running average)
            old_weight = 0.6
            new_weight = 0.4
            mastery.mastery_score = (old_weight * mastery.mastery_score) + (new_weight * score)
            mastery.mastery_score = min(1.0, mastery.mastery_score)

            # Check tier unlock
            next_tier_unlocked = False
            if tier == 1 and score >= MASTERY_THRESHOLD_TIER2:
                if mastery.tier_unlocked < 2:
                    mastery.tier_unlocked = 2
                    next_tier_unlocked = True
            elif tier == 2 and score >= MASTERY_THRESHOLD_TIER3:
                if mastery.tier_unlocked < 3:
                    mastery.tier_unlocked = 3
                    next_tier_unlocked = True

            wrong_count = max(total - correct_count, 0)
            if wrong_count > 0:
                weak = db.query(WeakTopic).filter(
                    WeakTopic.user_id == user_id,
                    WeakTopic.document_id == context_id,
                    WeakTopic.topic == mastery.topic,
                ).first()
                if not weak:
                    weak = WeakTopic(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        document_id=context_id,
                        topic=mastery.topic,
                        wrong_attempts=0,
                        weakness_score=0.0,
                    )
                    db.add(weak)
                weak.wrong_attempts += wrong_count
                weak.weakness_score = min(1.0, (weak.weakness_score * 0.7) + ((wrong_count / total) * 0.3))

            db.commit()

            return {
                "quiz_id": quiz_id,
                "tier": tier,
                "total_questions": total,
                "correct_answers": correct_count,
                "score": round(score, 3),
                "results": results,
                "next_tier_unlocked": next_tier_unlocked,
                "mastery_score": round(mastery.mastery_score, 3),
            }
        finally:
            db.close()

    def get_quiz_history(self, document_id: Optional[str] = None, user_id: str = "guest") -> List[Dict]:
        """Get quiz attempt history."""
        db = SessionLocal()
        try:
            query = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id)
            if document_id:
                query = query.filter(QuizAttempt.document_id == document_id)
            attempts = query.order_by(QuizAttempt.created_at.desc()).limit(50).all()

            return [
                {
                    "quiz_id": a.id,
                    "document_id": a.document_id,
                    "tier": a.tier,
                    "total_questions": a.total_questions,
                    "correct_answers": a.correct_answers,
                    "score": a.score,
                    "created_at": str(a.created_at),
                }
                for a in attempts
            ]
        finally:
            db.close()

    def get_mastery(self, document_id: Optional[str] = None, user_id: str = "guest") -> List[Dict]:
        """Get mastery scores."""
        db = SessionLocal()
        try:
            query = db.query(MasteryScore).filter(MasteryScore.user_id == user_id)
            if document_id:
                query = query.filter(MasteryScore.document_id == document_id)
            scores = query.all()

            return [
                {
                    "document_id": s.document_id,
                    "topic": s.topic,
                    "mastery_score": round(s.mastery_score, 3),
                    "tier_unlocked": s.tier_unlocked,
                    "total_attempts": s.total_attempts,
                    "last_studied": str(s.last_studied) if s.last_studied else None,
                }
                for s in scores
            ]
        finally:
            db.close()


# Singleton  
quiz_service = QuizService()
