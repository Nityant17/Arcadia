"""
Pydantic request/response schemas for the API.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# ─── Upload ───────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_name: str
    subject: str
    topic: str
    chunk_count: int
    extracted_text_preview: str = ""
    created_at: datetime


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


# ─── Chat ─────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    document_id: str = ""
    document_ids: List[str] = []
    topic: str = ""
    user_id: str = "guest"
    message: str
    language: str = "en"


class ChatResponse(BaseModel):
    answer: str
    sources: List[str] = []
    language: str = "en"


# ─── Quiz ─────────────────────────────────────────────────────

class QuizGenerateRequest(BaseModel):
    document_id: str
    tier: int = Field(default=1, ge=1, le=3)
    num_questions: int = Field(default=5, ge=1, le=15)
    language: str = "en"
    focus_topic: str = ""  # Optional: focus quiz on a specific chapter/topic


class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]          # 4 options (A, B, C, D)
    tier: int


class QuizGenerateResponse(BaseModel):
    quiz_id: str
    document_id: str
    tier: int
    questions: List[QuizQuestion]


class QuizAnswer(BaseModel):
    question_id: int
    selected_option: int        # 0-3 index


class QuizSubmitRequest(BaseModel):
    quiz_id: str
    document_id: str
    user_id: str = "guest"
    answers: List[QuizAnswer]


class QuizResult(BaseModel):
    question_id: int
    question: str
    selected_option: int
    correct_option: int
    is_correct: bool
    explanation: str = ""


class QuizSubmitResponse(BaseModel):
    quiz_id: str
    tier: int
    total_questions: int
    correct_answers: int
    score: float
    results: List[QuizResult]
    next_tier_unlocked: bool = False
    mastery_score: float = 0.0


# ─── Generate ─────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    document_id: str
    language: str = "en"
    focus_topic: str = ""  # Optional: focus on a specific chapter/topic


class CheatsheetResponse(BaseModel):
    document_id: str
    title: str
    content: str               # Markdown formatted
    language: str


class Flashcard(BaseModel):
    front: str
    back: str


class FlashcardsResponse(BaseModel):
    document_id: str
    cards: List[Flashcard]
    language: str


class DiagramResponse(BaseModel):
    document_id: str
    mermaid_code: str
    title: str


# ─── TTS ──────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    language: str = "en"


class TTSResponse(BaseModel):
    audio_url: str
    language: str


class TranslateRequest(BaseModel):
    text: str
    target_language: str = "hi"
    source_language: str = "en"


class TranslateResponse(BaseModel):
    original_text: str
    translated_text: str
    source_language: str
    target_language: str


# ─── Dashboard ────────────────────────────────────────────────

class TopicMastery(BaseModel):
    document_id: str
    topic: str
    mastery_score: float
    tier_unlocked: int
    total_attempts: int
    last_studied: Optional[datetime] = None


class DashboardStats(BaseModel):
    total_documents: int
    total_quizzes_taken: int
    average_score: float
    topics_mastered: int       # mastery > 0.8
    study_streak: int = 0


class DashboardResponse(BaseModel):
    stats: DashboardStats
    mastery: List[TopicMastery]


# ─── Topic Extraction ─────────────────────────────────────

class TopicItem(BaseModel):
    title: str
    summary: str = ""

class TopicsResponse(BaseModel):
    document_id: str
    topics: List[TopicItem]
    summary: str = ""
