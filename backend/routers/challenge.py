"""
Challenge Router — friend quiz challenge rooms.
"""
import datetime
import random
import string
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.database import (
    get_db,
    SessionLocal,
    User,
    ChallengeRoom,
    ChallengeParticipant,
)
from routers.auth import get_current_user
from services.quiz_service import quiz_service
from services.note_service import note_service

router = APIRouter()


class CreateRoomRequest(BaseModel):
    document_id: str = ""
    note_id: str = ""
    tier: int = Field(default=1, ge=1, le=3)
    num_questions: int = Field(default=5, ge=3, le=10)
    language: str = "en"
    focus_topic: str = ""


class JoinRoomRequest(BaseModel):
    code: str


class SubmitChallengeRequest(BaseModel):
    answers: list[dict]


def _generate_room_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        exists = db.query(ChallengeRoom).filter(ChallengeRoom.code == code).first()
        if not exists:
            return code
    raise HTTPException(500, "Failed to generate room code")


async def _prepare_room_quiz(
    room_id: str,
    context_id: str,
    document_ids: list[str],
    tier: int,
    num_questions: int,
    language: str,
    focus_topic: str,
):
    db = SessionLocal()
    try:
        room = db.query(ChallengeRoom).filter(ChallengeRoom.id == room_id).first()
        if not room:
            return

        quiz_data = await quiz_service.generate_quiz(
            context_id=context_id,
            document_ids=document_ids,
            tier=tier,
            num_questions=num_questions,
            language=language,
            focus_topic=focus_topic,
        )

        room.quiz_payload_json = quiz_data
        if room.status == "preparing":
            room.status = "waiting"
        db.commit()
    except Exception as exc:
        failed_room = db.query(ChallengeRoom).filter(ChallengeRoom.id == room_id).first()
        if failed_room:
            failed_room.status = "failed"
            failed_room.quiz_payload_json = {
                "questions": [],
                "error": str(exc),
            }
            db.commit()
    finally:
        db.close()


@router.post("/challenge/create")
async def create_room(
    request: CreateRoomRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document_ids, context_id = note_service.resolve_context(
        db,
        user_id=current_user.id,
        document_id=request.document_id,
        note_id=request.note_id,
    )
    if not document_ids:
        raise HTTPException(404, "No documents found for this challenge request")

    room = ChallengeRoom(
        id=str(uuid.uuid4()),
        code=_generate_room_code(db),
        host_user_id=current_user.id,
        document_id=context_id or request.document_id,
        tier=request.tier,
        num_questions=request.num_questions,
        status="preparing",
        quiz_payload_json={"questions": [], "status": "preparing"},
    )
    db.add(room)

    db.add(ChallengeParticipant(
        id=str(uuid.uuid4()),
        room_id=room.id,
        user_id=current_user.id,
        display_name=current_user.name,
        score=0.0,
        total_questions=request.num_questions,
    ))
    db.commit()

    background_tasks.add_task(
        _prepare_room_quiz,
        room.id,
        context_id or request.document_id,
        document_ids,
        request.tier,
        request.num_questions,
        request.language,
        request.focus_topic,
    )

    return {
        "code": room.code,
        "room_id": room.id,
        "status": room.status,
        "tier": room.tier,
        "num_questions": room.num_questions,
        "focus_topic": request.focus_topic,
    }


@router.post("/challenge/join")
def join_room(
    request: JoinRoomRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(ChallengeRoom).filter(ChallengeRoom.code == request.code.upper()).first()
    if not room:
        raise HTTPException(404, "Room not found")
    if room.status == "finished":
        raise HTTPException(400, "This challenge room is already finished")

    existing = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.room_id == room.id,
        ChallengeParticipant.user_id == current_user.id,
    ).first()
    if not existing:
        db.add(ChallengeParticipant(
            id=str(uuid.uuid4()),
            room_id=room.id,
            user_id=current_user.id,
            display_name=current_user.name,
            total_questions=room.num_questions,
        ))
        db.commit()

    return {"code": room.code, "room_id": room.id, "status": room.status}


@router.post("/challenge/{code}/start")
def start_room(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(ChallengeRoom).filter(ChallengeRoom.code == code.upper()).first()
    if not room:
        raise HTTPException(404, "Room not found")
    if room.host_user_id != current_user.id:
        raise HTTPException(403, "Only the host can start this challenge")
    if room.status == "preparing":
        raise HTTPException(409, "Quiz is still being prepared. Please wait.")
    if room.status == "failed":
        raise HTTPException(409, "Quiz generation failed. Please recreate the room.")
    if not room.quiz_payload_json.get("questions"):
        raise HTTPException(409, "Quiz is not ready yet. Please wait.")

    room.status = "active"
    db.commit()
    return {"status": "active", "code": room.code}


@router.get("/challenge/{code}")
def get_room(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(ChallengeRoom).filter(ChallengeRoom.code == code.upper()).first()
    if not room:
        raise HTTPException(404, "Room not found")

    participants = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.room_id == room.id
    ).all()

    return {
        "code": room.code,
        "status": room.status,
        "tier": room.tier,
        "num_questions": room.num_questions,
        "participants": [
            {
                "name": p.display_name,
                "score": p.score,
                "submitted": p.submitted_at is not None,
            }
            for p in participants
        ],
        "questions": [
            {
                "id": q["id"],
                "question": q["question"],
                "options": q["options"],
                "tier": q["tier"],
            }
            for q in room.quiz_payload_json.get("questions", [])
        ] if room.status == "active" else [],
    }


@router.post("/challenge/{code}/submit")
def submit_challenge(
    code: str,
    request: SubmitChallengeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(ChallengeRoom).filter(ChallengeRoom.code == code.upper()).first()
    if not room:
        raise HTTPException(404, "Room not found")
    if room.status != "active":
        raise HTTPException(400, "Challenge is not active")

    participant = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.room_id == room.id,
        ChallengeParticipant.user_id == current_user.id,
    ).first()
    if not participant:
        raise HTTPException(403, "Join the room first")

    answer_map = {a.get("question_id"): a.get("selected_option") for a in request.answers}
    questions = room.quiz_payload_json.get("questions", [])

    total = len(questions)
    correct = 0
    for q in questions:
        if answer_map.get(q.get("id")) == q.get("correct_option"):
            correct += 1

    score = (correct / total) if total else 0.0
    participant.score = score
    participant.total_questions = total
    participant.submitted_at = datetime.datetime.utcnow()

    all_participants = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.room_id == room.id
    ).all()
    if all(p.submitted_at is not None for p in all_participants):
        room.status = "finished"

    db.commit()

    return {"score": round(score, 3), "correct": correct, "total": total, "room_status": room.status}


@router.get("/challenge/{code}/leaderboard")
def leaderboard(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(ChallengeRoom).filter(ChallengeRoom.code == code.upper()).first()
    if not room:
        raise HTTPException(404, "Room not found")

    participants = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.room_id == room.id
    ).order_by(ChallengeParticipant.score.desc()).all()

    return {
        "code": room.code,
        "status": room.status,
        "leaderboard": [
            {
                "name": p.display_name,
                "score": p.score,
                "submitted": p.submitted_at is not None,
            }
            for p in participants
        ],
    }
