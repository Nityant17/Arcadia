"""
Quiz Router — Adaptive 3-tier quiz generation and scoring.
"""
from fastapi import APIRouter, HTTPException, Depends
from models.database import User

from models.schemas import (
    QuizGenerateRequest, QuizGenerateResponse, QuizQuestion,
    QuizSubmitRequest, QuizSubmitResponse, QuizResult,
)
from services.quiz_service import quiz_service
from routers.auth import get_current_user
from models.database import get_db
from sqlalchemy.orm import Session
from services.note_service import note_service

router = APIRouter()

# In-memory store for active quizzes (quiz_id → quiz data with answers)
_active_quizzes = {}


@router.post("/quiz/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    request: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a quiz for a document at the specified tier.
    Tier 1 = Recall, Tier 2 = Application, Tier 3 = Analysis.
    """
    document_ids, context_id = note_service.resolve_context(
        db,
        document_id=request.document_id,
        note_id=request.note_id,
    )
    if not document_ids:
        raise HTTPException(404, "No documents found for this quiz request")

    try:
        quiz_data = await quiz_service.generate_quiz(
            context_id=context_id or request.document_id,
            document_ids=document_ids,
            tier=request.tier,
            num_questions=request.num_questions,
            language=request.language,
            focus_topic=request.focus_topic,
        )
    except PermissionError as e:
        raise HTTPException(400, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Quiz generation failed: {e}")

    # Store full quiz data (with correct answers) for scoring later
    _active_quizzes[quiz_data["quiz_id"]] = quiz_data

    # Return questions WITHOUT correct answers
    return QuizGenerateResponse(
        quiz_id=quiz_data["quiz_id"],
        document_id=quiz_data["document_id"],
        note_id=quiz_data.get("note_id", ""),
        tier=quiz_data["tier"],
        questions=[
            QuizQuestion(
                id=q["id"],
                question=q["question"],
                options=q["options"],
                tier=q["tier"],
            )
            for q in quiz_data["questions"]
        ],
    )


@router.post("/quiz/submit", response_model=QuizSubmitResponse)
async def submit_quiz(
    request: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
):
    request.user_id = current_user.id
    """
    Submit quiz answers and get scored results.
    Also updates mastery score and checks tier unlock.
    """
    quiz_data = _active_quizzes.get(request.quiz_id)
    if not quiz_data:
        raise HTTPException(404, "Quiz not found or expired. Generate a new quiz.")

    try:
        result = quiz_service.submit_quiz(
            quiz_id=request.quiz_id,
            context_id=quiz_data.get("context_id") or request.note_id or request.document_id,
            questions=quiz_data["questions"],
            user_id=request.user_id,
            answers=[a.model_dump() for a in request.answers],
        )
    except Exception as e:
        raise HTTPException(500, f"Quiz scoring failed: {e}")

    # Clean up
    _active_quizzes.pop(request.quiz_id, None)

    return QuizSubmitResponse(
        quiz_id=result["quiz_id"],
        tier=result["tier"],
        total_questions=result["total_questions"],
        correct_answers=result["correct_answers"],
        score=result["score"],
        results=[
            QuizResult(
                question_id=r["question_id"],
                question=r["question"],
                selected_option=r["selected_option"],
                correct_option=r["correct_option"],
                is_correct=r["is_correct"],
                explanation=r.get("explanation", ""),
            )
            for r in result["results"]
        ],
        next_tier_unlocked=result["next_tier_unlocked"],
        mastery_score=result["mastery_score"],
    )


@router.get("/quiz/history")
async def quiz_history(document_id: str = None, current_user = Depends(get_current_user)):
    """Get quiz attempt history, optionally filtered by document."""
    return quiz_service.get_quiz_history(document_id)
