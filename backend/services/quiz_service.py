"""
Quiz Engine — 3-tier adaptive quizzing with mastery tracking.
Tier 1: Recall (definitions, facts)
Tier 2: Application (problem-solving, scenarios)
Tier 3: Analysis (evaluation, synthesis, critical thinking)
"""
import uuid
import datetime
from typing import List, Dict, Optional

from models.database import SessionLocal, QuizAttempt, MasteryScore, Document, WeakTopic
from services.llm_service import llm_service
from services.rag_service import rag_service
from services.translate_service import translate_service
from services.safety_service import safety_service
from config import MASTERY_THRESHOLD_TIER2, MASTERY_THRESHOLD_TIER3, QUIZ_QUESTIONS_PER_TIER


class QuizService:

    async def generate_quiz(self, document_id: str, tier: int = 1,
                            num_questions: int = QUIZ_QUESTIONS_PER_TIER,
                            language: str = "en", focus_topic: str = "") -> Dict:
        """Generate quiz questions from a document's content."""
        focus_safety = safety_service.check_text(focus_topic)
        if not focus_safety.allowed:
            raise PermissionError(focus_safety.reason)

        # 1. Get document context
        if focus_topic:
            # Use RAG to fetch chunks relevant to the specific topic
            chunks = rag_service.query(focus_topic, document_id=document_id, top_k=8)
            context = "\n\n".join(c["text"] for c in chunks) if chunks else ""
            if not context:
                context = rag_service.get_document_text(document_id) or ""
        else:
            context = rag_service.get_document_text(document_id)
        if not context:
            raise ValueError(f"No content found for document '{document_id}'")

        # Truncate context if too long (LLM context window)
        max_context_chars = 6000
        if len(context) > max_context_chars:
            context = context[:max_context_chars]

        context_safety = safety_service.check_text(context[:6000])
        if not context_safety.allowed:
            raise PermissionError(context_safety.reason)

        # 2. Generate questions via LLM (always in English for reliability)
        system_prompt, user_prompt = llm_service.build_quiz_prompt(
            context, tier, num_questions, "en"
        )
        result = await llm_service.generate_json(user_prompt, system_prompt, temperature=0.4)

        # 3. Parse and validate questions
        questions = result.get("questions", [])
        if not questions:
            raise ValueError("LLM returned no questions")

        generated_bundle = "\n".join(
            f"{q.get('question', '')}\n{' '.join(q.get('options', []))}\n{q.get('explanation', '')}"
            for q in questions
        )
        generated_safety = safety_service.check_text(generated_bundle[:9000])
        if not generated_safety.allowed:
            raise PermissionError(generated_safety.reason)

        quiz_id = str(uuid.uuid4())

        formatted_questions = []
        for i, q in enumerate(questions[:num_questions]):
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
            "document_id": document_id,
            "tier": tier,
            "questions": formatted_questions,
        }

    def submit_quiz(self, quiz_id: str, document_id: str,
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
                document_id=document_id,
                tier=tier,
                total_questions=total,
                correct_answers=correct_count,
                score=score,
                questions_json=results,
            )
            db.add(attempt)

            # Update mastery score
            mastery = db.query(MasteryScore).filter(
                MasteryScore.document_id == document_id
            ).first()

            if not mastery:
                # Look up document name for a human-readable topic label
                doc = db.query(Document).filter(Document.id == document_id).first()
                doc_topic = doc.original_name.rsplit('.', 1)[0] if doc else document_id[:8]
                mastery = MasteryScore(
                    id=str(uuid.uuid4()),
                    document_id=document_id,
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
                    WeakTopic.document_id == document_id,
                    WeakTopic.topic == mastery.topic,
                ).first()
                if not weak:
                    weak = WeakTopic(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        document_id=document_id,
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

    def get_quiz_history(self, document_id: Optional[str] = None) -> List[Dict]:
        """Get quiz attempt history."""
        db = SessionLocal()
        try:
            query = db.query(QuizAttempt)
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

    def get_mastery(self, document_id: Optional[str] = None) -> List[Dict]:
        """Get mastery scores."""
        db = SessionLocal()
        try:
            query = db.query(MasteryScore)
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
