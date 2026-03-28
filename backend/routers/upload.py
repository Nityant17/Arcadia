"""
Upload Router — File upload, OCR, and document management.
"""
import uuid
import shutil
import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from config import UPLOAD_DIR
from models.database import (
    get_db,
    Document,
    Note,
    DocumentInsight,
    QuizAttempt,
    MasteryScore,
    ChatHistory,
    WeakTopic,
    StudyMaterial,
    ChallengeRoom,
    ChallengeParticipant,
)
from models.schemas import (
    DocumentResponse,
    DocumentListResponse,
    TopicsResponse,
    TopicItem,
    DocumentStarUpdateRequest,
    DocumentStarUpdateResponse,
    PinnedDocumentItem,
    NoteResponse,
    NoteUpdateRequest,
    NoteUpdateResponse,
    NoteStarUpdateResponse,
)
from routers.auth import get_current_user
from services.ocr_service import ocr_service
from services.rag_service import rag_service
from services.llm_service import llm_service
from services.safety_service import safety_service
from services.note_service import note_service

router = APIRouter()

# ADD THIS HELPER AT TOP (after imports)

def clean_unicode(text: str) -> str:
    if not text:
        return ""
    return text.encode("utf-8", "ignore").decode("utf-8", "ignore")


def _note_title(db: Session, note_id: str, user_id: str) -> str:
    if not note_id:
        return ""
    note_row = (
        db.query(Note)
        .filter(Note.id == note_id)
        .filter(Note.user_id == user_id)
        .first()
    )
    return note_row.title if note_row else ""

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    subject: str = Form(default="General"),
    topic: str = Form(default=""),
    note_id: str = Form(default=""),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a PDF, image, or text file.
    → OCR extracts text → chunks are embedded → indexed in the vector store.
    """
    # Validate file type
    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".txt"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {allowed_extensions}")

    doc_id = str(uuid.uuid4())
    selected_note_id = (note_id or "").strip()

    if selected_note_id:
        note = (
            db.query(Note)
            .filter(Note.id == selected_note_id)
            .filter(Note.user_id == current_user.id)
            .first()
        )
        if not note:
            raise HTTPException(404, "Target note not found")
        note.updated_at = datetime.datetime.utcnow()
    else:
        selected_note_id = str(uuid.uuid4())
        note_title = (
            (topic or "").strip()
            or (file.filename.rsplit(".", 1)[0] if "." in file.filename else file.filename)
            or "Untitled note"
        )
        note = Note(
            id=selected_note_id,
            user_id=current_user.id,
            title=note_title,
            subject=(subject or "General").strip() or "General",
        )
        db.add(note)
        db.flush()
    saved_filename = f"{doc_id}{ext}"
    save_path = UPLOAD_DIR / saved_filename

    # Save file to disk
    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(500, f"Failed to save file: {e}")

    image_safety = safety_service.check_image_file(str(save_path))
    if not image_safety.allowed:
        save_path.unlink(missing_ok=True)
        raise HTTPException(400, image_safety.reason)

    # OCR / text extraction
    try:
        extracted_text = ocr_service.extract_text(str(save_path))
        extracted_text = clean_unicode(extracted_text)  # 🔥 FIX
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

    # Index in vector store
    try:
        chunk_count = rag_service.index_document(doc_id, extracted_text, subject, topic)
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(422, f"Failed to index extracted text: {e}")

    # Save to database
    doc = Document(
        id=doc_id,
        user_id=current_user.id,
        note_id=selected_note_id,
        filename=saved_filename,
        original_name=file.filename,
        subject=subject,
        topic=topic or file.filename.rsplit(".", 1)[0],
        extracted_text=clean_unicode(extracted_text)[:1000000],
        chunk_count=chunk_count,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return DocumentResponse(
        id=doc.id,
        note_id=doc.note_id or "",
        note_title=note.title if note else "",
        filename=doc.filename,
        original_name=doc.original_name,
        subject=doc.subject,
        topic=doc.topic,
        is_starred=bool(doc.is_starred),
        chunk_count=doc.chunk_count,
        extracted_text_preview=extracted_text[:300] + "..." if len(extracted_text) > 300 else extracted_text,
        created_at=doc.created_at,
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all uploaded documents."""
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    note_titles = {
        n.id: n.title
        for n in db.query(Note)
        .filter(Note.id.in_([d.note_id for d in docs if d.note_id]))
        .filter(Note.user_id == current_user.id)
        .all()
    }
    return DocumentListResponse(
        documents=[
            DocumentResponse(
                id=d.id,
                note_id=d.note_id or d.id,
                note_title=note_titles.get(d.note_id or "", ""),
                filename=d.filename,
                original_name=d.original_name,
                subject=d.subject,
                topic=d.topic,
                is_starred=bool(d.is_starred),
                chunk_count=d.chunk_count,
                extracted_text_preview=d.extracted_text[:300] + "..." if d.extracted_text and len(d.extracted_text) > 300 else (d.extracted_text or ""),
                created_at=d.created_at,
            )
            for d in docs
        ],
        total=len(docs),
    )


@router.get("/notes", response_model=list[NoteResponse])
async def list_notes(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    note_rows = (
        db.query(
            Note.id,
            Note.title,
            Note.subject,
            Note.created_at,
            Note.updated_at,
            func.count(Document.id).label("document_count"),
        )
        .outerjoin(Document, Document.note_id == Note.id)
        .filter(Note.user_id == current_user.id)
        .filter(or_(Document.user_id == current_user.id, Document.id.is_(None)))
        .group_by(Note.id)
        .order_by(Note.updated_at.desc())
        .all()
    )
    return [
        NoteResponse(
            id=row.id,
            title=row.title,
            subject=row.subject or "General",
            document_count=int(row.document_count or 0),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in note_rows
    ]


@router.get("/documents/pinned", response_model=list[PinnedDocumentItem])
async def list_pinned_documents(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = (
        db.query(Document)
        .filter(Document.is_starred.is_(True))
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    if not docs:
        return []

    note_ids = [d.note_id or d.id for d in docs]
    note_titles = {
        n.id: n.title
        for n in db.query(Note)
        .filter(Note.id.in_(note_ids))
        .filter(Note.user_id == current_user.id)
        .all()
    }

    grouped: dict[str, PinnedDocumentItem] = {}
    for d in docs:
        key = d.note_id or d.id
        if key in grouped:
            continue
        grouped[key] = PinnedDocumentItem(
            id=key,
            label=note_titles.get(key) or d.topic or d.original_name,
            to=f"/notes?noteId={key}",
        )

    return list(grouped.values())


@router.patch("/documents/{doc_id}/star", response_model=DocumentStarUpdateResponse)
async def set_document_star(
    doc_id: str,
    payload: DocumentStarUpdateRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id)
        .filter(Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(404, "Document not found")

    doc.is_starred = payload.starred
    db.commit()

    return DocumentStarUpdateResponse(id=doc.id, is_starred=bool(doc.is_starred))


@router.patch("/notes/{note_id}/star", response_model=NoteStarUpdateResponse)
async def set_note_star(
    note_id: str,
    payload: DocumentStarUpdateRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(Document)
        .filter(or_(Document.note_id == note_id, Document.id == note_id))
        .filter(Document.user_id == current_user.id)
        .all()
    )
    if not docs:
        raise HTTPException(404, "Note not found")

    resolved_note_id = (docs[0].note_id or docs[0].id or note_id).strip()
    for doc in docs:
        if not doc.note_id:
            doc.note_id = resolved_note_id
        doc.is_starred = payload.starred
    db.commit()
    return NoteStarUpdateResponse(note_id=resolved_note_id, is_starred=payload.starred)

from pydantic import BaseModel
from typing import Optional

class DocumentUpdateRequest(BaseModel):
    filename: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None

@router.patch("/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(
    doc_id: str,
    payload: DocumentUpdateRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a document's display name, subject, or topic."""
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id)
        .filter(Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(404, "Document not found")

    if payload.filename is not None and payload.filename.strip():
        doc.original_name = payload.filename.strip()
    if payload.subject is not None:
        doc.subject = payload.subject.strip()
    if payload.topic is not None:
        doc.topic = payload.topic.strip()

    db.commit()
    db.refresh(doc)

    return DocumentResponse(
        id=doc.id,
        note_id=doc.note_id or "",
        note_title=_note_title(db, doc.note_id or "", current_user.id),
        filename=doc.filename,
        original_name=doc.original_name,
        subject=doc.subject,
        topic=doc.topic,
        is_starred=bool(doc.is_starred),
        chunk_count=doc.chunk_count,
        extracted_text_preview=doc.extracted_text[:300] + "..." if doc.extracted_text and len(doc.extracted_text) > 300 else (doc.extracted_text or ""),
        created_at=doc.created_at,
    )


@router.patch("/notes/{note_id}", response_model=NoteUpdateResponse)
async def update_note(
    note_id: str,
    payload: NoteUpdateRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(Document)
        .filter(or_(Document.note_id == note_id, Document.id == note_id))
        .filter(Document.user_id == current_user.id)
        .all()
    )
    if not docs:
        raise HTTPException(404, "No documents found in this note")

    resolved_note_id = (docs[0].note_id or docs[0].id or note_id).strip()
    note = (
        db.query(Note)
        .filter(Note.id == resolved_note_id)
        .filter(Note.user_id == current_user.id)
        .first()
    )
    if not note:
        initial_title = (
            (payload.title or "").strip()
            or (docs[0].topic or "").strip()
            or (docs[0].original_name or "").strip()
            or "Untitled note"
        )
        initial_subject = (
            (payload.subject or "").strip()
            or (docs[0].subject or "").strip()
            or "General"
        )
        note = Note(
            id=resolved_note_id,
            user_id=current_user.id,
            title=initial_title,
            subject=initial_subject,
        )
        db.add(note)
        db.flush()

    for doc in docs:
        if not doc.note_id:
            doc.note_id = resolved_note_id

    if payload.title is not None and payload.title.strip():
        note.title = payload.title.strip()

    if payload.subject is not None:
        normalized_subject = payload.subject.strip() or "General"
        note.subject = normalized_subject
        for doc in docs:
            doc.subject = normalized_subject

    if payload.topic is not None:
        normalized_topic = payload.topic.strip()
        for doc in docs:
            doc.topic = normalized_topic

    note.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(note)

    updated_docs = (
        db.query(Document)
        .filter(Document.note_id == note.id)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    response_docs = [
        DocumentResponse(
            id=d.id,
            note_id=d.note_id or d.id,
            note_title=note.title,
            filename=d.filename,
            original_name=d.original_name,
            subject=d.subject,
            topic=d.topic,
            is_starred=bool(d.is_starred),
            chunk_count=d.chunk_count,
            extracted_text_preview=d.extracted_text[:300] + "..." if d.extracted_text and len(d.extracted_text) > 300 else (d.extracted_text or ""),
            created_at=d.created_at,
        )
        for d in updated_docs
    ]

    return NoteUpdateResponse(
        note=NoteResponse(
            id=note.id,
            title=note.title,
            subject=note.subject or "General",
            document_count=len(updated_docs),
            created_at=note.created_at,
            updated_at=note.updated_at,
        ),
        documents=response_docs,
    )

@router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get a single document's details."""
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id)
        .filter(Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(404, "Document not found")
    return DocumentResponse(
        id=doc.id,
        note_id=doc.note_id or "",
        note_title=_note_title(db, doc.note_id or "", current_user.id),
        filename=doc.filename,
        original_name=doc.original_name,
        subject=doc.subject,
        topic=doc.topic,
        is_starred=bool(doc.is_starred),
        chunk_count=doc.chunk_count,
        extracted_text_preview=doc.extracted_text[:500] if doc.extracted_text else "",
        created_at=doc.created_at,
    )


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a document and all related data (embeddings, generated materials, quiz/chat traces)."""
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id)
        .filter(Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(404, "Document not found")

    # Remove from vector store
    rag_service.delete_document(doc_id)

    # Remove file
    file_path = UPLOAD_DIR / doc.filename
    file_path.unlink(missing_ok=True)

    # Remove all related rows from DB for this exact document.
    challenge_room_ids = [
        room.id
        for room in db.query(ChallengeRoom.id)
        .filter(ChallengeRoom.document_id == doc_id)
        .filter(ChallengeRoom.host_user_id == current_user.id)
        .all()
    ]
    if challenge_room_ids:
        db.query(ChallengeParticipant).filter(ChallengeParticipant.room_id.in_(challenge_room_ids)).delete(
            synchronize_session=False
        )

    db.query(ChallengeRoom).filter(ChallengeRoom.document_id == doc_id).delete(synchronize_session=False)
    db.query(StudyMaterial).filter(StudyMaterial.document_id == doc_id).filter(StudyMaterial.user_id == current_user.id).delete(synchronize_session=False)
    db.query(DocumentInsight).filter(DocumentInsight.document_id == doc_id).filter(DocumentInsight.user_id == current_user.id).delete(synchronize_session=False)
    db.query(ChatHistory).filter(ChatHistory.document_id == doc_id).filter(ChatHistory.user_id == current_user.id).delete(synchronize_session=False)
    db.query(QuizAttempt).filter(QuizAttempt.document_id == doc_id).filter(QuizAttempt.user_id == current_user.id).delete(synchronize_session=False)
    db.query(MasteryScore).filter(MasteryScore.document_id == doc_id).filter(MasteryScore.user_id == current_user.id).delete(synchronize_session=False)
    db.query(WeakTopic).filter(WeakTopic.document_id == doc_id).filter(WeakTopic.user_id == current_user.id).delete(synchronize_session=False)

    note_id = doc.note_id
    db.delete(doc)
    db.flush()

    if note_id:
        remaining = (
            db.query(Document.id)
            .filter(Document.note_id == note_id)
            .filter(Document.user_id == current_user.id)
            .count()
        )
        if remaining == 0:
            db.query(Note).filter(Note.id == note_id).filter(Note.user_id == current_user.id).delete(synchronize_session=False)
            db.query(ChatHistory).filter(ChatHistory.document_id == note_id).filter(ChatHistory.user_id == current_user.id).delete(synchronize_session=False)
            db.query(QuizAttempt).filter(QuizAttempt.document_id == note_id).filter(QuizAttempt.user_id == current_user.id).delete(synchronize_session=False)
            db.query(MasteryScore).filter(MasteryScore.document_id == note_id).filter(MasteryScore.user_id == current_user.id).delete(synchronize_session=False)
            db.query(WeakTopic).filter(WeakTopic.document_id == note_id).filter(WeakTopic.user_id == current_user.id).delete(synchronize_session=False)
            db.query(StudyMaterial).filter(StudyMaterial.document_id == note_id).filter(StudyMaterial.user_id == current_user.id).delete(synchronize_session=False)

    db.commit()

    return {"status": "deleted", "id": doc_id}


@router.post("/documents/{doc_id}/topics", response_model=TopicsResponse)
async def extract_topics(
    doc_id: str,
    force: bool = False,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Extract chapters/topics from a document using the LLM."""
    doc = (
        db.query(Document)
        .filter(Document.id == doc_id)
        .filter(Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        fallback_docs = (
            db.query(Document)
            .filter(Document.note_id == doc_id)
            .filter(Document.user_id == current_user.id)
            .all()
        )
        if not fallback_docs:
            raise HTTPException(404, "Document not found")
        doc = fallback_docs[0]

    note_doc_ids, context_id = note_service.resolve_context(
        db,
        user_id=current_user.id,
        document_id=doc_id,
    )
    context_docs = (
        db.query(Document)
        .filter(Document.id.in_(note_doc_ids))
        .filter(Document.user_id == current_user.id)
        .all()
    ) if note_doc_ids else [doc]
    context = "\n\n".join((d.extracted_text or "") for d in context_docs if d.extracted_text).strip()
    if not context:
        raise HTTPException(422, "No text content available for this document")

    cache_key = (context_id or doc.note_id or doc.id or doc_id).strip()
    cache_aliases = {cache_key}
    for context_doc in context_docs:
        if context_doc.id:
            cache_aliases.add(context_doc.id)
        if context_doc.note_id:
            cache_aliases.add(context_doc.note_id)

    insight_rows = (
        db.query(DocumentInsight)
        .filter(DocumentInsight.document_id.in_(list(cache_aliases)))
        .filter(DocumentInsight.user_id == current_user.id)
        .order_by(DocumentInsight.updated_at.desc())
        .all()
    )
    cached_insight = next((row for row in insight_rows if row.document_id == cache_key), None)
    if not cached_insight and insight_rows:
        cached_insight = insight_rows[0]
        cached_insight.document_id = cache_key

    if cached_insight:
        for row in insight_rows:
            if row.id != cached_insight.id:
                db.delete(row)
        db.flush()

    if cached_insight and not force:
        cached_topics = cached_insight.topics_json or []
        db.commit()
        return TopicsResponse(
            document_id=cache_key,
            topics=[TopicItem(title=t.get("title", ""), summary=t.get("summary", "")) for t in cached_topics],
            summary=cached_insight.summary_text or "",
        )

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

    normalized_topics = [
        TopicItem(title=t.get("title", ""), summary=t.get("summary", ""))
        for t in topics
    ]
    composed_summary = "\n\n".join(
        [f"• {item.title}: {item.summary.strip()}" for item in normalized_topics if item.summary and item.summary.strip()]
    )
    if not composed_summary:
        composed_summary = doc.extracted_text[:600] if doc.extracted_text else ""

    serialized_topics = [{"title": item.title, "summary": item.summary} for item in normalized_topics]
    if cached_insight:
        cached_insight.topics_json = serialized_topics
        cached_insight.summary_text = composed_summary
    else:
        db.add(DocumentInsight(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            document_id=cache_key,
            topics_json=serialized_topics,
            summary_text=composed_summary,
        ))
    db.commit()

    return TopicsResponse(
        document_id=cache_key,
        topics=normalized_topics,
        summary=composed_summary,
    )
