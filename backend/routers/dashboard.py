"""
Dashboard Router — Mastery tracking, statistics, progress overview.
"""
import os
import glob
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.database import get_db, Document, Note, QuizAttempt, MasteryScore, ChatHistory, WeakTopic
from routers.auth import get_current_user
from models.schemas import DashboardStats, DashboardResponse, TopicMastery
from services.quiz_service import quiz_service
from config import AUDIO_DIR

router = APIRouter()


@router.get("/dashboard/stats")
async def get_dashboard(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get full dashboard: stats + per-topic mastery."""
    # Counts
    total_docs = db.query(func.count(Document.id)).filter(Document.user_id == current_user.id).scalar() or 0
    total_quizzes = db.query(func.count(QuizAttempt.id)).filter(QuizAttempt.user_id == current_user.id).scalar() or 0
    avg_score = (
        db.query(func.avg(QuizAttempt.score))
        .filter(QuizAttempt.user_id == current_user.id)
        .scalar() or 0.0
    )
    topics_mastered = (
        db.query(func.count(MasteryScore.id))
        .filter(MasteryScore.mastery_score >= 0.8)
        .filter(MasteryScore.user_id == current_user.id)
        .scalar() or 0
    )

    stats = DashboardStats(
        total_documents=total_docs,
        total_quizzes_taken=total_quizzes,
        average_score=round(float(avg_score), 3),
        topics_mastered=topics_mastered,
        study_streak=0,  # TODO: implement streak logic
    )

    # Per-topic mastery — resolve UUIDs to document names if needed
    mastery_data = quiz_service.get_mastery(user_id=current_user.id)
    mastery_list = []
    for m in mastery_data:
        topic = m["topic"]
        # If topic looks like a UUID, resolve it from Document or Note table
        if len(topic) == 36 and topic.count('-') == 4:
            doc = (
                db.query(Document)
                .filter(Document.id == topic)
                .filter(Document.user_id == current_user.id)
                .first()
            )
            if doc:
                topic = doc.original_name.rsplit('.', 1)[0]
            else:
                note = (
                    db.query(Note)
                    .filter(Note.id == topic)
                    .filter(Note.user_id == current_user.id)
                    .first()
                )
                if note:
                    topic = note.title
            # Also fix it in the DB for future queries
            ms = db.query(MasteryScore).filter(
                MasteryScore.document_id == m["document_id"]
            ).filter(
                MasteryScore.user_id == current_user.id
            ).first()
            if ms and topic:
                ms.topic = topic
                db.commit()
        mastery_list.append(
            TopicMastery(
                document_id=m["document_id"],
                topic=topic,
                mastery_score=m["mastery_score"],
                tier_unlocked=m["tier_unlocked"],
                total_attempts=m["total_attempts"],
                last_studied=m.get("last_studied"),
            )
        )

    return DashboardResponse(stats=stats, mastery=mastery_list)


@router.get("/dashboard/mastery")
async def get_mastery(document_id: str = None, current_user = Depends(get_current_user)):
    """Get mastery scores, optionally filtered by document."""
    return quiz_service.get_mastery(document_id, user_id=current_user.id)


@router.get("/dashboard/recent-quizzes")
async def recent_quizzes(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get 10 most recent quiz attempts."""
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id)
        .order_by(QuizAttempt.created_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "quiz_id": a.id,
            "document_id": a.document_id,
            "tier": a.tier,
            "score": a.score,
            "correct": a.correct_answers,
            "total": a.total_questions,
            "created_at": str(a.created_at),
        }
        for a in attempts
    ]


@router.delete("/dashboard/reset")
async def reset_progress(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Clear ALL quiz attempts, mastery scores, chat history, and cached TTS audio."""
    deleted_quizzes = db.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).delete()
    deleted_mastery = db.query(MasteryScore).filter(MasteryScore.user_id == current_user.id).delete()
    deleted_weak_topics = db.query(WeakTopic).filter(WeakTopic.user_id == current_user.id).delete()
    deleted_chats = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
    db.commit()

    # Clear cached TTS audio files
    audio_files = glob.glob(str(AUDIO_DIR / "*.mp3"))
    for f in audio_files:
        try:
            os.remove(f)
        except OSError:
            pass

    return {
        "status": "reset_complete",
        "deleted": {
            "quiz_attempts": deleted_quizzes,
            "mastery_scores": deleted_mastery,
            "weak_topics": deleted_weak_topics,
            "chat_history": deleted_chats,
            "audio_files": len(audio_files),
        },
    }
