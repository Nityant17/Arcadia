"""
Generate Router — Cheatsheets, Flashcards, Mermaid Diagrams.
"""
from fastapi import APIRouter, HTTPException

from models.schemas import (
    GenerateRequest, CheatsheetResponse,
    FlashcardsResponse, Flashcard, DiagramResponse,
)
from services.generate_service import generate_service

router = APIRouter()


@router.post("/generate/cheatsheet", response_model=CheatsheetResponse)
async def generate_cheatsheet(request: GenerateRequest):
    """Generate a one-page cheatsheet from a document's content."""
    try:
        result = await generate_service.generate_cheatsheet(
            request.document_id, request.language, request.focus_topic
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Cheatsheet generation failed: {e}")

    return CheatsheetResponse(**result)


@router.post("/generate/flashcards", response_model=FlashcardsResponse)
async def generate_flashcards(request: GenerateRequest):
    """Generate a flashcard deck from a document's content."""
    try:
        result = await generate_service.generate_flashcards(
            request.document_id, request.language, request.focus_topic
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Flashcard generation failed: {e}")

    return FlashcardsResponse(
        document_id=result["document_id"],
        cards=[Flashcard(**c) for c in result["cards"]],
        language=result["language"],
    )


@router.post("/generate/diagram", response_model=DiagramResponse)
async def generate_diagram(request: GenerateRequest):
    """Generate a Mermaid.js concept diagram from a document."""
    try:
        result = await generate_service.generate_diagram(request.document_id)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Diagram generation failed: {e}")

    return DiagramResponse(**result)
