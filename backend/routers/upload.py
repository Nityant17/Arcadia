"""
Upload Router — File upload, OCR, and document management.
"""
import uuid
import shutil
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session

from config import UPLOAD_DIR
from models.database import get_db, Document
from models.schemas import DocumentResponse, DocumentListResponse, TopicsResponse, TopicItem
from routers.auth import get_current_user
from services.ocr_service import ocr_service
from services.rag_service import rag_service
from services.llm_service import llm_service
from services.safety_service import safety_service

router = APIRouter()


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    subject: str = Form(default="General"),
    topic: str = Form(default=""),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a PDF, image, or text file.
    → OCR extracts text → chunks are embedded → indexed in ChromaDB.
    """
    # Validate file type
    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".txt"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {allowed_extensions}")

    doc_id = str(uuid.uuid4())
    saved_filename = f"{doc_id}{ext}"
    save_path = UPLOAD_DIR / saved_filename

    # Save file to disk
    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(500, f"Failed to save file: {e}")

    # OCR / text extraction
    try:
        extracted_text = ocr_service.extract_text(str(save_path))
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(422, f"Text extraction failed: {e}")

    if not extracted_text or len(extracted_text.strip()) < 10:
        save_path.unlink(missing_ok=True)
        raise HTTPException(422, "Could not extract meaningful text from the file.")

    safety = safety_service.check_text(extracted_text[:6000])
    if not safety.allowed:
        save_path.unlink(missing_ok=True)
        raise HTTPException(400, safety.reason)

    # Index in ChromaDB
    chunk_count = rag_service.index_document(doc_id, extracted_text, subject, topic)

    # Save to database
    doc = Document(
        id=doc_id,
        filename=saved_filename,
        original_name=file.filename,
        subject=subject,
        topic=topic or file.filename.rsplit(".", 1)[0],
        extracted_text=extracted_text,
        chunk_count=chunk_count,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        original_name=doc.original_name,
        subject=doc.subject,
        topic=doc.topic,
        chunk_count=doc.chunk_count,
        extracted_text_preview=extracted_text[:300] + "..." if len(extracted_text) > 300 else extracted_text,
        created_at=doc.created_at,
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all uploaded documents."""
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return DocumentListResponse(
        documents=[
            DocumentResponse(
                id=d.id,
                filename=d.filename,
                original_name=d.original_name,
                subject=d.subject,
                topic=d.topic,
                chunk_count=d.chunk_count,
                extracted_text_preview=d.extracted_text[:300] + "..." if d.extracted_text and len(d.extracted_text) > 300 else (d.extracted_text or ""),
                created_at=d.created_at,
            )
            for d in docs
        ],
        total=len(docs),
    )


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get a single document's details."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        original_name=doc.original_name,
        subject=doc.subject,
        topic=doc.topic,
        chunk_count=doc.chunk_count,
        extracted_text_preview=doc.extracted_text[:500] if doc.extracted_text else "",
        created_at=doc.created_at,
    )


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a document and its vector embeddings."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    # Remove from ChromaDB
    rag_service.delete_document(doc_id)

    # Remove file
    file_path = UPLOAD_DIR / doc.filename
    file_path.unlink(missing_ok=True)

    # Remove from DB
    db.delete(doc)
    db.commit()

    return {"status": "deleted", "id": doc_id}


@router.post("/documents/{doc_id}/topics", response_model=TopicsResponse)
async def extract_topics(doc_id: str, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Extract chapters/topics from a document using the LLM."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    context = doc.extracted_text or ""
    if not context:
        raise HTTPException(422, "No text content available for this document")

    # Truncate for LLM context window
    if len(context) > 8000:
        context = context[:8000]

    system_prompt, user_prompt = llm_service.build_topics_prompt(context)

    try:
        result = await llm_service.generate_json(user_prompt, system_prompt, temperature=0.3)
        topics = result.get("topics", [])
    except Exception:
        # Fallback: return generic topics
        topics = [{"title": "Full Document", "summary": "Complete document content"}]

    return TopicsResponse(
        document_id=doc_id,
        topics=[TopicItem(title=t.get("title", ""), summary=t.get("summary", "")) for t in topics],
    )
