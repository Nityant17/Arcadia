"""
SQLite database — documents, quiz attempts, mastery scores.
"""
import datetime
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, JSON
from sqlalchemy.orm import declarative_base, sessionmaker

from config import SQLITE_DB_PATH

engine = create_engine(f"sqlite:///{SQLITE_DB_PATH}", echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


# ─── ORM Models ───────────────────────────────────────────────

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)               # UUID
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    subject = Column(String, default="General")
    topic = Column(String, default="")
    extracted_text = Column(Text, default="")
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False)
    tier = Column(Integer, default=1)                    # 1, 2, 3
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    questions_json = Column(JSON, default=[])             # full Q&A stored
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class MasteryScore(Base):
    __tablename__ = "mastery_scores"

    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False)
    topic = Column(String, default="")
    mastery_score = Column(Float, default=0.0)           # 0.0 — 1.0
    tier_unlocked = Column(Integer, default=1)           # highest tier unlocked
    total_attempts = Column(Integer, default=0)
    last_studied = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False)
    role = Column(String, nullable=False)                # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─── Init ─────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)
    print("📦 SQLite database initialized")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
