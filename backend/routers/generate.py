"""
Generate Router — Cheatsheets, Flashcards, Mermaid Diagrams.
"""
import uuid

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from models.database import User, StudyMaterial, get_db
from routers.auth import get_current_user

from models.schemas import (
    GenerateRequest, CheatsheetResponse,
    FlashcardsResponse, Flashcard, DiagramResponse,
)
from services.generate_service import generate_service
from services.note_service import note_service

router = APIRouter()


def _normalize_focus_topic(value: str) -> str:
    return (value or "").strip()


def _get_cached_material(
    db: Session,
    user_id: str,
    document_id: str,
    language: str,
    focus_topic: str,
    material_type: str,
):
    return (
        db.query(StudyMaterial)
        .filter(
            StudyMaterial.user_id == user_id,
            StudyMaterial.document_id == document_id,
            StudyMaterial.language == language,
            StudyMaterial.focus_topic == focus_topic,
            StudyMaterial.material_type == material_type,
        )
        .first()
    )


def _save_cached_material(
    db: Session,
    user_id: str,
    document_id: str,
    language: str,
    focus_topic: str,
    material_type: str,
    payload: dict,
):
    row = _get_cached_material(db, user_id, document_id, language, focus_topic, material_type)
    if row:
        row.payload_json = payload
    else:
        db.add(StudyMaterial(
            id=str(uuid.uuid4()),
            user_id=user_id,
            document_id=document_id,
            language=language,
            focus_topic=focus_topic,
            material_type=material_type,
            payload_json=payload,
        ))
    db.commit()


@router.get("/generate/stored/{document_id}")
def get_stored_materials(
    document_id: str,
    note_id: str = "",
    language: str = "en",
    focus_topic: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized_focus_topic = _normalize_focus_topic(focus_topic)
    _, context_id = note_service.resolve_context(
        db,
        document_id=document_id,
        note_id=note_id,
    )
    resolved_context_id = context_id or document_id

    rows = (
        db.query(StudyMaterial)
        .filter(
            StudyMaterial.user_id == current_user.id,
            StudyMaterial.document_id == resolved_context_id,
            StudyMaterial.language == language,
            StudyMaterial.focus_topic == normalized_focus_topic,
        )
        .all()
    )
    cached = {row.material_type: (row.payload_json or {}) for row in rows}
    return {
        "document_id": resolved_context_id,
        "language": language,
        "focus_topic": normalized_focus_topic,
        "cheatsheet": cached.get("cheatsheet"),
        "flashcards": cached.get("flashcards"),
        "diagram": cached.get("diagram"),
    }


@router.post("/generate/cheatsheet", response_model=CheatsheetResponse)
async def generate_cheatsheet(
    request: GenerateRequest,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a one-page cheatsheet from a document's content."""
    request.focus_topic = _normalize_focus_topic(request.focus_topic)
    document_ids, context_id = note_service.resolve_context(
        db,
        document_id=request.document_id,
        note_id=request.note_id,
    )
    if not document_ids:
        raise HTTPException(404, "No documents found for this study request")
    resolved_context_id = context_id or request.document_id

    if not force:
        cached = _get_cached_material(
            db,
            current_user.id,
            resolved_context_id,
            request.language,
            request.focus_topic,
            "cheatsheet",
        )
        if cached and cached.payload_json:
            return CheatsheetResponse(**cached.payload_json)

    try:
        result = await generate_service.generate_cheatsheet(
            resolved_context_id, document_ids, request.language, request.focus_topic
        )
    except PermissionError as e:
        raise HTTPException(400, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Cheatsheet generation failed: {e}")

    _save_cached_material(
        db,
        current_user.id,
        resolved_context_id,
        request.language,
        request.focus_topic,
        "cheatsheet",
        result,
    )

    return CheatsheetResponse(**result)


@router.post("/generate/flashcards", response_model=FlashcardsResponse)
async def generate_flashcards(
    request: GenerateRequest,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a flashcard deck from a document's content."""
    request.focus_topic = _normalize_focus_topic(request.focus_topic)
    document_ids, context_id = note_service.resolve_context(
        db,
        document_id=request.document_id,
        note_id=request.note_id,
    )
    if not document_ids:
        raise HTTPException(404, "No documents found for this study request")
    resolved_context_id = context_id or request.document_id

    if not force:
        cached = _get_cached_material(
            db,
            current_user.id,
            resolved_context_id,
            request.language,
            request.focus_topic,
            "flashcards",
        )
        if cached and cached.payload_json:
            payload = cached.payload_json
            return FlashcardsResponse(
                document_id=payload.get("document_id", resolved_context_id),
                cards=[Flashcard(**c) for c in payload.get("cards", [])],
                language=payload.get("language", request.language),
            )

    try:
        result = await generate_service.generate_flashcards(
            resolved_context_id, document_ids, request.language, request.focus_topic
        )
    except PermissionError as e:
        raise HTTPException(400, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Flashcard generation failed: {e}")

    _save_cached_material(
        db,
        current_user.id,
        resolved_context_id,
        request.language,
        request.focus_topic,
        "flashcards",
        result,
    )

    return FlashcardsResponse(
        document_id=result["document_id"],
        cards=[Flashcard(**c) for c in result["cards"]],
        language=result["language"],
    )


@router.post("/generate/diagram", response_model=DiagramResponse)
async def generate_diagram(
    request: GenerateRequest,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a Mermaid.js concept diagram from a document."""
    request.focus_topic = _normalize_focus_topic(request.focus_topic)
    document_ids, context_id = note_service.resolve_context(
        db,
        document_id=request.document_id,
        note_id=request.note_id,
    )
    if not document_ids:
        raise HTTPException(404, "No documents found for this study request")
    resolved_context_id = context_id or request.document_id

    if not force:
        cached = _get_cached_material(
            db,
            current_user.id,
            resolved_context_id,
            request.language,
            request.focus_topic,
            "diagram",
        )
        if cached and cached.payload_json:
            return DiagramResponse(**cached.payload_json)

    try:
        result = await generate_service.generate_diagram(resolved_context_id, document_ids)
    except PermissionError as e:
        raise HTTPException(400, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Diagram generation failed: {e}")

    diagram_payload = {
        "document_id": result["document_id"],
        "mermaid_code": result["mermaid_code"],
        "title": result["title"],
    }
    _save_cached_material(
        db,
        current_user.id,
        resolved_context_id,
        request.language,
        request.focus_topic,
        "diagram",
        diagram_payload,
    )

    return DiagramResponse(**result)
