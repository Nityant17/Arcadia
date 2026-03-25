"""
RAG Service — ChromaDB vector store + sentence-transformers embeddings.
Handles document chunking, indexing, and retrieval.
"""
from typing import List, Dict, Optional
import chromadb
from chromadb.utils import embedding_functions
from sqlalchemy.exc import SQLAlchemyError

from config import (
    CHROMA_DB_DIR, EMBEDDING_MODEL_NAME, 
    CHUNK_MAX_TOKENS, CHUNK_OVERLAP_TOKENS, RAG_TOP_K
)
from models.database import SessionLocal, Document


class RAGService:
    """Manages the vector store for RAG retrieval."""

    def __init__(self):
        self._client: Optional[chromadb.PersistentClient] = None
        self._collection = None
        self._ef = None

    def initialize(self):
        """Initialize ChromaDB + embedding function. Called at startup."""
        print(f"🔍 Loading embedding model: {EMBEDDING_MODEL_NAME}")
        self._ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL_NAME
        )
        self._client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
        self._collection = self._client.get_or_create_collection(
            name="arcadia_docs",
            embedding_function=self._ef,
            metadata={"hnsw:space": "cosine"}
        )
        count = self._collection.count()
        print(f"🗂️  ChromaDB initialized — {count} chunks indexed")

    # ─── Chunking ─────────────────────────────────────────────

    @staticmethod
    def chunk_text(text: str, max_tokens: int = CHUNK_MAX_TOKENS,
                   overlap: int = CHUNK_OVERLAP_TOKENS) -> List[str]:
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
            start += (max_tokens - overlap)
        return chunks

    @staticmethod
    def _normalize_chunks(chunks: List[str]) -> List[str]:
        """Ensure all chunks are non-empty strings accepted by tokenizer."""
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

    # ─── Indexing ──────────────────────────────────────────────

    def index_document(self, doc_id: str, text: str, 
                   subject: str = "General", topic: str = "") -> int:
        """Chunk and index a document. Returns number of chunks created."""

        if text is None:
            raise ValueError("Input text is None")

        if not isinstance(text, str):
            text = str(text)

        # ─── STEP 1: Chunk + normalize ─────────────────────────────
        raw_chunks = self.chunk_text(text)
        chunks = self._normalize_chunks(raw_chunks)

        # ─── STEP 2: HARD CLEANING (critical fix) ──────────────────
        clean_chunks = []
        for c in chunks:
            if not isinstance(c, str):
                continue

            c = c.strip()

            # Remove encoding junk (OCR artifacts)
            c = c.encode("utf-8", "ignore").decode("utf-8")

            # Skip garbage / tiny chunks
            if len(c) < 10:
                continue

            clean_chunks.append(c)

        chunks = clean_chunks

        # ─── STEP 3: Validate final chunks ─────────────────────────
        if not chunks:
            raise ValueError("No valid chunks after cleaning (bad OCR or empty file)")

        # ─── STEP 4: Prepare data ──────────────────────────────────
        ids = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            clean_chunk = str(chunk).strip()

            ids.append(f"{doc_id}_chunk_{i}")
            documents.append(clean_chunk)
            metadatas.append({
                "document_id": doc_id,
                "chunk_index": i,
                "subject": subject,
                "topic": topic,
            })

        # ─── STEP 5: Batch insert with strict validation ───────────
        batch_size = 100

        for start in range(0, len(ids), batch_size):
            end = start + batch_size

            batch_ids = ids[start:end]
            batch_docs = documents[start:end]
            batch_meta = metadatas[start:end]

            # 🚨 FINAL SAFETY CHECK (prevents your exact error)
            for d in batch_docs:
                if not isinstance(d, str):
                    raise ValueError(f"Invalid chunk type: {type(d)}")
                if not d.strip():
                    raise ValueError("Empty chunk detected in batch")

            # DEBUG (optional, remove later)
            print("DEBUG → Sample docs:", batch_docs[:2])

            self._collection.add(
                ids=batch_ids,
                documents=batch_docs,
                metadatas=batch_meta,
            )

        return len(chunks)

    # ─── Retrieval ────────────────────────────────────────────

    def query(self, query_text: str, document_id: Optional[str] = None,
              top_k: int = RAG_TOP_K) -> List[Dict]:
        """
        Retrieve the most relevant chunks for a query.
        Optionally filter by document_id.
        """
        where_filter = None
        if document_id:
            where_filter = {"document_id": document_id}

        results = self._collection.query(
            query_texts=[query_text],
            n_results=top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

        chunks = []
        if results["documents"] and results["documents"][0]:
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                chunks.append({
                    "text": doc,
                    "metadata": meta,
                    "distance": dist,
                    "relevance": 1 - dist,  # cosine distance → similarity
                })

        return chunks

    # ─── Get all text for a document ──────────────────────────

    def get_document_text(self, document_id: str) -> str:
        """Retrieve all indexed chunks for a document, joined in order."""
        results = self._collection.get(
            where={"document_id": document_id},
            include=["documents", "metadatas"],
        )

        if not results["documents"]:
            return ""

        # Sort by chunk_index
        paired = list(zip(results["documents"], results["metadatas"]))
        paired.sort(key=lambda x: x[1].get("chunk_index", 0))

        return "\n".join([p[0] for p in paired])

        
    def get_document_text_with_fallback(self, document_id: str) -> str:
        """
        Retrieve document text from Chroma first, then fall back to SQLite
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
        self._collection.delete(where={"document_id": document_id})

    # ─── Stats ────────────────────────────────────────────────

    def get_total_chunks(self) -> int:
        return self._collection.count() if self._collection else 0


# Singleton
rag_service = RAGService()
