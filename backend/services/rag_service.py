"""
RAG Service — ChromaDB vector store + sentence-transformers embeddings.
Handles document chunking, indexing, and retrieval.
"""
from typing import List, Dict, Optional
import chromadb
from chromadb.utils import embedding_functions

from config import (
    CHROMA_DB_DIR, EMBEDDING_MODEL_NAME, 
    CHUNK_MAX_TOKENS, CHUNK_OVERLAP_TOKENS, RAG_TOP_K
)


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

    # ─── Indexing ──────────────────────────────────────────────

    def index_document(self, doc_id: str, text: str, 
                       subject: str = "General", topic: str = "") -> int:
        """Chunk and index a document. Returns number of chunks created."""
        chunks = self.chunk_text(text)
        if not chunks:
            return 0

        ids = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            ids.append(f"{doc_id}_chunk_{i}")
            documents.append(chunk)
            metadatas.append({
                "document_id": doc_id,
                "chunk_index": i,
                "subject": subject,
                "topic": topic,
            })

        # Add in batches of 100 to avoid ChromaDB limits
        batch_size = 100
        for start in range(0, len(ids), batch_size):
            end = start + batch_size
            self._collection.add(
                ids=ids[start:end],
                documents=documents[start:end],
                metadatas=metadatas[start:end],
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

    # ─── Delete ───────────────────────────────────────────────

    def delete_document(self, document_id: str):
        """Remove all chunks for a document from the vector store."""
        self._collection.delete(where={"document_id": document_id})

    # ─── Stats ────────────────────────────────────────────────

    def get_total_chunks(self) -> int:
        return self._collection.count() if self._collection else 0


# Singleton
rag_service = RAGService()
