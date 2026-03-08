"""
Chat Router — RAG-powered multilingual chatbot.
"""
import uuid

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from models.database import get_db, ChatHistory, Document
from models.schemas import ChatRequest, ChatResponse
from services.rag_service import rag_service
from services.llm_service import llm_service
from services.translate_service import translate_service

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    RAG chatbot: retrieves relevant chunks from the student's notes,
    then generates a contextual answer using the LLM.
    """
    # Validate document exists
    doc = db.query(Document).filter(Document.id == request.document_id).first()
    if not doc:
        raise HTTPException(404, "Document not found. Upload a document first.")

    # 1. Retrieve relevant chunks
    query_text = request.message
    # If the query is in another language, translate to English for retrieval
    if request.language != "en":
        try:
            query_text = translate_service.translate(
                request.message, target_language="en", source_language=request.language
            )
        except Exception:
            query_text = request.message  # Fallback to original

    chunks = rag_service.query(query_text, document_id=request.document_id)

    if not chunks:
        return ChatResponse(
            answer="I couldn't find relevant information in your uploaded notes. "
                   "Try uploading more material or rephrasing your question.",
            sources=[],
            language=request.language,
        )

    # 2. Build RAG prompt (always in English for best LLM quality)
    system_prompt, user_prompt = llm_service.build_rag_prompt(
        request.message, chunks, "en"
    )

    # 3. Generate answer (in English)
    try:
        answer = await llm_service.generate(user_prompt, system_prompt)
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"LLM generation failed: {e}")

    # 3b. Translate answer to target language if not English
    if request.language != "en":
        try:
            answer = translate_service.translate(
                answer, target_language=request.language, source_language="en"
            )
        except Exception:
            pass  # Keep English answer if translation fails

    # 4. Save chat history
    try:
        db.add(ChatHistory(
            id=str(uuid.uuid4()),
            document_id=request.document_id,
            role="user",
            content=request.message,
        ))
        db.add(ChatHistory(
            id=str(uuid.uuid4()),
            document_id=request.document_id,
            role="assistant",
            content=answer,
        ))
        db.commit()
    except Exception:
        pass  # Don't fail the response if history save fails

    # 5. Extract source references
    sources = list(set(
        c["metadata"].get("document_id", "") for c in chunks if c.get("metadata")
    ))

    return ChatResponse(
        answer=answer,
        sources=sources,
        language=request.language,
    )


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    """
    Streaming RAG chat — returns tokens as Server-Sent Events (SSE).
    """
    doc = db.query(Document).filter(Document.id == request.document_id).first()
    if not doc:
        raise HTTPException(404, "Document not found.")

    # Retrieve context
    chunks = rag_service.query(request.message, document_id=request.document_id)
    system_prompt, user_prompt = llm_service.build_rag_prompt(
        request.message, chunks, request.language
    )

    async def event_generator():
        try:
            async for token in llm_service.stream_generate(user_prompt, system_prompt):
                yield f"data: {token}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {e}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/chat/history/{document_id}")
async def get_chat_history(document_id: str, db: Session = Depends(get_db)):
    """Get chat history for a document."""
    messages = (
        db.query(ChatHistory)
        .filter(ChatHistory.document_id == document_id)
        .order_by(ChatHistory.created_at.asc())
        .limit(100)
        .all()
    )
    return [
        {"role": m.role, "content": m.content, "created_at": str(m.created_at)}
        for m in messages
    ]
