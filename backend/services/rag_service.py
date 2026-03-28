"""
RAG Service — pgvector-backed chunk storage and retrieval.
Falls back to in-Python similarity ranking when pgvector operators are unavailable.
"""
from __future__ import annotations

import math
import uuid
from typing import Dict, List, Optional

from sentence_transformers import SentenceTransformer
from sqlalchemy.exc import SQLAlchemyError

from config import (
    CHUNK_MAX_TOKENS,
    CHUNK_OVERLAP_TOKENS,
    EMBEDDING_MODEL_NAME,
    RAG_TOP_K,
)
from models.database import (
    Document,
    DocumentChunk,
    PGVECTOR_ENABLED,
    SessionLocal,
)


class RAGService:
    """Manages chunking, embedding, indexing, and retrieval for RAG."""

    def __init__(self):
        self._embedder: Optional[SentenceTransformer] = None

    def initialize(self):
        """Initialize embedding model. Called at startup."""
        if self._embedder is None:
            print(f"🔍 Loading embedding model: {EMBEDDING_MODEL_NAME}")
            self._embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)
        count = self.get_total_chunks()
        store_name = "pgvector" if PGVECTOR_ENABLED else "database-fallback"
        print(f"🗂️  Vector store initialized ({store_name}) — {count} chunks indexed")

    # ─── Embeddings ───────────────────────────────────────────

    def _ensure_embedder(self) -> SentenceTransformer:
        if self._embedder is None:
            self._embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)
        return self._embedder

    def _embed_texts(self, texts: list[str]) -> list[list[float]]:
        embedder = self._ensure_embedder()
        vectors = embedder.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return vectors.tolist()

    def _embed_text(self, text: str) -> list[float]:
        return self._embed_texts([text])[0]

    # ─── Chunking ─────────────────────────────────────────────

    @staticmethod
    def chunk_text(
        text: str,
        max_tokens: int = CHUNK_MAX_TOKENS,
        overlap: int = CHUNK_OVERLAP_TOKENS,
    ) -> List[str]:
        """Split text into overlapping chunks by whitespace tokens."""
        text = text.strip()
        if not text:
            return []

        tokens = text.split()
        if len(tokens) <= max_tokens:
            return [text]

        chunks = []
        start = 0
        while start < len(tokens):
            end = min(start + max_tokens, len(tokens))
            chunk = " ".join(tokens[start:end])
            chunks.append(chunk)
            if end >= len(tokens):
                break
            start += max(1, (max_tokens - overlap))
        return chunks

    @staticmethod
    def _normalize_chunks(chunks: List[str]) -> List[str]:
        normalized: List[str] = []
        for chunk in chunks:
            if chunk is None:
                continue
            if not isinstance(chunk, str):
                chunk = str(chunk)
            chunk = chunk.strip()
            if chunk:
                normalized.append(chunk)
        return normalized

    @staticmethod
    def _clean_chunks(chunks: list[str]) -> list[str]:
        cleaned: list[str] = []
        for chunk in chunks:
            value = (chunk or "").strip()
            value = value.encode("utf-8", "ignore").decode("utf-8")
            if len(value) < 10:
                continue
            cleaned.append(value)
        return cleaned

    @staticmethod
    def _cosine_distance(a: list[float], b: list[float]) -> float:
        if not a or not b:
            return 1.0
        if len(a) != len(b):
            return 1.0

        dot = 0.0
        norm_a = 0.0
        norm_b = 0.0
        for x, y in zip(a, b):
            dot += float(x) * float(y)
            norm_a += float(x) * float(x)
            norm_b += float(y) * float(y)

        if norm_a <= 0.0 or norm_b <= 0.0:
            return 1.0

        similarity = dot / (math.sqrt(norm_a) * math.sqrt(norm_b))
        similarity = max(-1.0, min(1.0, similarity))
        return 1.0 - similarity

    def _query_extracted_text_fallback(
        self,
        db,
        query_embedding: list[float],
        document_id: str,
        top_k: int,
    ) -> list[dict]:
        """
        Fallback retrieval for legacy records that have extracted_text but no
        indexed chunks yet (for smooth SQLite -> Postgres transitions).
        """
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document or not (document.extracted_text or "").strip():
            return []

        chunks = self._clean_chunks(self._normalize_chunks(self.chunk_text(document.extracted_text)))
        if not chunks:
            return []

        embeddings = self._embed_texts(chunks)
        scored = [
            (index, chunk, self._cosine_distance(query_embedding, embedding))
            for index, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
        scored.sort(key=lambda item: item[2])

        return [
            {
                "text": chunk_text,
                "metadata": {
                    "document_id": document_id,
                    "chunk_index": chunk_index,
                    "subject": document.subject,
                    "topic": document.topic,
                },
                "distance": float(distance),
                "relevance": 1 - float(distance),
            }
            for chunk_index, chunk_text, distance in scored[:top_k]
        ]

    # ─── Indexing ──────────────────────────────────────────────

    def index_document(
        self,
        doc_id: str,
        text: str,
        subject: str = "General",
        topic: str = "",
    ) -> int:
        """Chunk and index a document. Returns number of chunks created."""
        if text is None:
            raise ValueError("Input text is None")
        if not isinstance(text, str):
            text = str(text)

        raw_chunks = self.chunk_text(text)
        chunks = self._clean_chunks(self._normalize_chunks(raw_chunks))
        if not chunks:
            raise ValueError("No valid chunks after cleaning (bad OCR or empty file)")

        embeddings = self._embed_texts(chunks)
        db = SessionLocal()
        try:
            db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete(
                synchronize_session=False
            )

            rows = [
                DocumentChunk(
                    id=str(uuid.uuid4()),
                    document_id=doc_id,
                    chunk_index=index,
                    subject=subject,
                    topic=topic,
                    content=chunk,
                    embedding=embedding,
                )
                for index, (chunk, embedding) in enumerate(zip(chunks, embeddings))
            ]
            db.add_all(rows)

            document = db.query(Document).filter(Document.id == doc_id).first()
            if document:
                document.chunk_count = len(chunks)

            db.commit()
            return len(chunks)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    # ─── Retrieval ────────────────────────────────────────────

    def query(
        self,
        query_text: str,
        document_id: Optional[str] = None,
        top_k: int = RAG_TOP_K,
    ) -> List[Dict]:
        """
        Retrieve the most relevant chunks for a query.
        Optionally filter by document_id.
        """
        if not query_text or not query_text.strip():
            return []

        query_embedding = self._embed_text(query_text.strip())
        db = SessionLocal()
        try:
            if PGVECTOR_ENABLED:
                distance_expr = DocumentChunk.embedding.cosine_distance(query_embedding).label("distance")
                query = db.query(DocumentChunk, distance_expr)
                if document_id:
                    query = query.filter(DocumentChunk.document_id == document_id)

                rows = query.order_by(distance_expr.asc()).limit(top_k).all()
                chunk_hits = [
                    {
                        "text": chunk.content,
                        "metadata": {
                            "document_id": chunk.document_id,
                            "chunk_index": chunk.chunk_index,
                            "subject": chunk.subject,
                            "topic": chunk.topic,
                        },
                        "distance": float(distance),
                        "relevance": 1 - float(distance),
                    }
                    for chunk, distance in rows
                ]
                if chunk_hits:
                    return chunk_hits
                if document_id:
                    return self._query_extracted_text_fallback(db, query_embedding, document_id, top_k)
                return []

            base_query = db.query(DocumentChunk)
            if document_id:
                base_query = base_query.filter(DocumentChunk.document_id == document_id)
            chunk_rows = base_query.all()

            scored = []
            for row in chunk_rows:
                embedding = row.embedding
                if not isinstance(embedding, list):
                    continue
                distance = self._cosine_distance(query_embedding, embedding)
                scored.append((row, distance))

            scored.sort(key=lambda item: item[1])
            top_rows = scored[:top_k]
            chunk_hits = [
                {
                    "text": chunk.content,
                    "metadata": {
                        "document_id": chunk.document_id,
                        "chunk_index": chunk.chunk_index,
                        "subject": chunk.subject,
                        "topic": chunk.topic,
                    },
                    "distance": float(distance),
                    "relevance": 1 - float(distance),
                }
                for chunk, distance in top_rows
            ]
            if chunk_hits:
                return chunk_hits
            if document_id:
                return self._query_extracted_text_fallback(db, query_embedding, document_id, top_k)
            return []
        finally:
            db.close()

    # ─── Get all text for a document ──────────────────────────

    def get_document_text(self, document_id: str) -> str:
        """Retrieve all indexed chunks for a document, joined in order."""
        db = SessionLocal()
        try:
            rows = (
                db.query(DocumentChunk)
                .filter(DocumentChunk.document_id == document_id)
                .order_by(DocumentChunk.chunk_index.asc())
                .all()
            )
            if not rows:
                return ""
            return "\n".join(row.content for row in rows if row.content)
        finally:
            db.close()

    def get_document_text_with_fallback(self, document_id: str) -> str:
        """
        Retrieve document text from chunk store first, then fall back to
        documents.extracted_text when chunks are unavailable.
        """
        text = self.get_document_text(document_id)
        if text:
            return text

        db = SessionLocal()
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if document and document.extracted_text:
                return document.extracted_text
        except SQLAlchemyError:
            return ""
        finally:
            db.close()

        return ""

    # ─── Delete ───────────────────────────────────────────────

    def delete_document(self, document_id: str):
        """Remove all chunks for a document from the vector store."""
        db = SessionLocal()
        try:
            db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete(
                synchronize_session=False
            )
            db.commit()
        finally:
            db.close()

    # ─── Stats ────────────────────────────────────────────────

    def get_total_chunks(self) -> int:
        db = SessionLocal()
        try:
            return db.query(DocumentChunk).count()
        finally:
            db.close()


# Singleton
rag_service = RAGService()
