"""
Note Service - resolves logical-note document scopes with backward compatibility.
"""
from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

from models.database import Document, Note


def _dedupe(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


class NoteService:
    @staticmethod
    def resolve_context(
        db: Session,
        *,
        user_id: str = "",
        document_id: str = "",
        document_ids: list[str] | None = None,
        note_id: str = "",
        topic: str = "",
    ) -> tuple[list[str], str]:
        """
        Returns (document_ids, context_id).
        context_id is note_id when scoped to a note, otherwise a document id.
        """
        if note_id:
            note_docs = (
                db.query(Document.id)
                .filter(Document.note_id == note_id)
                .filter(Document.user_id == user_id)
                .all()
            )
            doc_ids = _dedupe([row[0] for row in note_docs])
            return doc_ids, note_id

        if document_ids:
            expanded: list[str] = []
            for raw_id in document_ids:
                doc = (
                    db.query(Document)
                    .filter(Document.id == raw_id)
                    .filter(Document.user_id == user_id)
                    .first()
                )
                if doc:
                    same_note_docs = (
                        db.query(Document.id)
                        .filter(Document.note_id == doc.note_id)
                        .filter(Document.user_id == user_id)
                        .all()
                    )
                    expanded.extend([row[0] for row in same_note_docs])
                    continue

                possible_note_docs = (
                    db.query(Document.id)
                    .filter(Document.note_id == raw_id)
                    .filter(Document.user_id == user_id)
                    .all()
                )
                expanded.extend([row[0] for row in possible_note_docs])

            doc_ids = _dedupe(expanded)
            context_id = ""
            if doc_ids:
                first_doc = (
                    db.query(Document)
                    .filter(Document.id == doc_ids[0])
                    .filter(Document.user_id == user_id)
                    .first()
                )
                context_id = first_doc.note_id if first_doc and first_doc.note_id else doc_ids[0]
            return doc_ids, context_id

        if topic:
            topic_docs = (
                db.query(Document)
                .filter(Document.topic == topic)
                .filter(Document.user_id == user_id)
                .all()
            )
            doc_ids = _dedupe([d.id for d in topic_docs])
            context_id = ""
            if doc_ids:
                first_doc = (
                    db.query(Document)
                    .filter(Document.id == doc_ids[0])
                    .filter(Document.user_id == user_id)
                    .first()
                )
                context_id = first_doc.note_id if first_doc and first_doc.note_id else doc_ids[0]
            return doc_ids, context_id

        if document_id:
            doc = (
                db.query(Document)
                .filter(Document.id == document_id)
                .filter(Document.user_id == user_id)
                .first()
            )
            if doc:
                note_docs = (
                    db.query(Document.id)
                    .filter(Document.note_id == doc.note_id)
                    .filter(Document.user_id == user_id)
                    .all()
                )
                doc_ids = _dedupe([row[0] for row in note_docs])
                context_id = doc.note_id if doc.note_id else document_id
                return doc_ids, context_id

            possible_note_docs = (
                db.query(Document.id)
                .filter(Document.note_id == document_id)
                .filter(Document.user_id == user_id)
                .all()
            )
            doc_ids = _dedupe([row[0] for row in possible_note_docs])
            return doc_ids, document_id if doc_ids else ""

        return [], ""

    @staticmethod
    def get_note(db: Session, note_id: str) -> Note | None:
        return db.query(Note).filter(Note.id == note_id).first()

    @staticmethod
    def resolve_context_id_from_any_id(db: Session, any_id: str, user_id: str = "") -> str:
        doc = (
            db.query(Document)
            .filter(Document.id == any_id)
            .filter(Document.user_id == user_id)
            .first()
        )
        if doc and doc.note_id:
            return doc.note_id
        return any_id


note_service = NoteService()
