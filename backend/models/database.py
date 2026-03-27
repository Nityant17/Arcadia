"""
SQLite database — documents, quiz attempts, mastery scores.
"""
import datetime
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Date, Text, JSON, Boolean, text
from sqlalchemy.orm import declarative_base, sessionmaker

from config import SQLITE_DB_PATH

engine = create_engine(f"sqlite:///{SQLITE_DB_PATH}", echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


# ─── ORM Models ───────────────────────────────────────────────

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)               # UUID
    user_id = Column(String, nullable=False, default="guest")
    note_id = Column(String, nullable=False, default="")
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    subject = Column(String, default="General")
    topic = Column(String, default="")
    extracted_text = Column(Text, default="")
    is_starred = Column(Boolean, default=False)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class DocumentInsight(Base):
    __tablename__ = "document_insights"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, default="guest")
    document_id = Column(String, nullable=False, unique=True)
    topics_json = Column(JSON, default=[])
    summary_text = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)


class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, default="guest")
    title = Column(String, nullable=False, default="Untitled note")
    subject = Column(String, default="General")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, default="guest")
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
    user_id = Column(String, nullable=False, default="guest")
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
    user_id = Column(String, nullable=False, default="guest")
    document_id = Column(String, nullable=False)
    role = Column(String, nullable=False)                # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    email_verified = Column(Boolean, default=True)
    auth_provider = Column(String, default="local")
    provider_subject = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    token = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    email = Column(String, nullable=False)
    code_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class WeakTopic(Base):
    __tablename__ = "weak_topics"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, default="guest")
    document_id = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    wrong_attempts = Column(Integer, default=0)
    weakness_score = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    title = Column(String, default="Study Plan")
    metadata_json = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class StudyTask(Base):
    __tablename__ = "study_tasks"

    id = Column(String, primary_key=True)
    plan_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    task_type = Column(String, default="revision")
    due_date = Column(DateTime, nullable=False)
    estimated_minutes = Column(Integer, default=30)
    spaced_interval_days = Column(Integer, default=0)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ChallengeRoom(Base):
    __tablename__ = "challenge_rooms"

    id = Column(String, primary_key=True)
    code = Column(String, nullable=False, unique=True)
    host_user_id = Column(String, nullable=False)
    document_id = Column(String, nullable=False)
    tier = Column(Integer, default=1)
    num_questions = Column(Integer, default=5)
    status = Column(String, default="waiting")
    quiz_payload_json = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ChallengeParticipant(Base):
    __tablename__ = "challenge_participants"

    id = Column(String, primary_key=True)
    room_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    score = Column(Float, default=0.0)
    total_questions = Column(Integer, default=0)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)


class StudyMaterial(Base):
    __tablename__ = "study_materials"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    document_id = Column(String, nullable=False)
    language = Column(String, default="en")
    focus_topic = Column(String, default="")
    material_type = Column(String, nullable=False)  # cheatsheet | flashcards | diagram
    payload_json = Column(JSON, default={})
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)


class UserStreak(Base):
    __tablename__ = "user_streaks"

    user_id = Column(String, primary_key=True)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_completed_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)


class UserCalendarToken(Base):
    __tablename__ = "user_calendar_tokens"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    provider = Column(String, nullable=False)  # google
    access_token = Column(Text, nullable=False, default="")
    refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)


class CalendarEventLink(Base):
    __tablename__ = "calendar_event_links"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    provider = Column(String, nullable=False)  # google
    task_id = Column(String, nullable=False)
    event_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ─── Init ─────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as connection:
        table_info = connection.execute(text("PRAGMA table_info(documents)")).fetchall()
        column_names = {row[1] for row in table_info}
        if "is_starred" not in column_names:
            connection.execute(text("ALTER TABLE documents ADD COLUMN is_starred BOOLEAN DEFAULT 0"))
            connection.commit()
        if "note_id" not in column_names:
            connection.execute(text("ALTER TABLE documents ADD COLUMN note_id TEXT DEFAULT ''"))
            connection.commit()
        if "user_id" not in column_names:
            connection.execute(text("ALTER TABLE documents ADD COLUMN user_id TEXT DEFAULT 'guest'"))
            connection.commit()

        connection.execute(text("UPDATE documents SET note_id = id WHERE note_id IS NULL OR note_id = ''"))
        connection.execute(text("UPDATE documents SET user_id = 'guest' WHERE user_id IS NULL OR user_id = ''"))
        connection.execute(text("""
            INSERT INTO notes (id, title, subject, created_at, updated_at)
            SELECT d.note_id, COALESCE(NULLIF(d.topic, ''), d.original_name), COALESCE(NULLIF(d.subject, ''), 'General'), d.created_at, d.created_at
            FROM documents d
            LEFT JOIN notes n ON n.id = d.note_id
            WHERE n.id IS NULL
        """))
        connection.commit()

        note_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(notes)")).fetchall()}
        if "user_id" not in note_columns:
            connection.execute(text("ALTER TABLE notes ADD COLUMN user_id TEXT DEFAULT 'guest'"))
            connection.commit()
        connection.execute(text("UPDATE notes SET user_id = 'guest' WHERE user_id IS NULL OR user_id = ''"))

        insight_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(document_insights)")).fetchall()}
        if "user_id" not in insight_columns:
            connection.execute(text("ALTER TABLE document_insights ADD COLUMN user_id TEXT DEFAULT 'guest'"))
            connection.commit()
        connection.execute(text("UPDATE document_insights SET user_id = 'guest' WHERE user_id IS NULL OR user_id = ''"))

        quiz_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(quiz_attempts)")).fetchall()}
        if "user_id" not in quiz_columns:
            connection.execute(text("ALTER TABLE quiz_attempts ADD COLUMN user_id TEXT DEFAULT 'guest'"))
            connection.commit()
        connection.execute(text("UPDATE quiz_attempts SET user_id = 'guest' WHERE user_id IS NULL OR user_id = ''"))

        mastery_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(mastery_scores)")).fetchall()}
        if "user_id" not in mastery_columns:
            connection.execute(text("ALTER TABLE mastery_scores ADD COLUMN user_id TEXT DEFAULT 'guest'"))
            connection.commit()
        connection.execute(text("UPDATE mastery_scores SET user_id = 'guest' WHERE user_id IS NULL OR user_id = ''"))

        chat_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(chat_history)")).fetchall()}
        if "user_id" not in chat_columns:
            connection.execute(text("ALTER TABLE chat_history ADD COLUMN user_id TEXT DEFAULT 'guest'"))
            connection.commit()
        connection.execute(text("UPDATE chat_history SET user_id = 'guest' WHERE user_id IS NULL OR user_id = ''"))

        user_info = connection.execute(text("PRAGMA table_info(users)")).fetchall()
        user_columns = {row[1] for row in user_info}
        if "email_verified" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 1"))
            connection.commit()
        if "auth_provider" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'"))
            connection.commit()
        if "provider_subject" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN provider_subject TEXT DEFAULT ''"))
            connection.commit()
    print("📦 SQLite database initialized")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
