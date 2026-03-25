"""
Planner Router — timetable + spaced repetition schedule.
"""
import datetime
import math
import re
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.database import get_db, StudyPlan, StudyTask, WeakTopic, Document, QuizAttempt, ChatHistory
from models.database import User
from routers.auth import get_current_user

router = APIRouter()


class SubjectInput(BaseModel):
    subject: str
    exam_date: str | datetime.date | datetime.datetime
    weekly_hours: float | int | str = 4


class PlanRequest(BaseModel):
    user_id: str = ""
    title: str = "Exam Study Plan"
    subjects: List[SubjectInput]


def _parse_exam_date(value: str | datetime.date | datetime.datetime) -> datetime.date:
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value

    text = str(value or "").strip()
    if not text:
        return datetime.date.today() + datetime.timedelta(days=30)

    date_part = text.split("T", 1)[0]
    try:
        return datetime.date.fromisoformat(date_part)
    except ValueError:
        return datetime.date.today() + datetime.timedelta(days=30)


def _parse_weekly_hours(value: float | int | str) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = 4.0
    return min(40.0, max(1.0, parsed))


def _extract_topics_from_text(text: str) -> list[str]:
    lines = [line.strip() for line in (text or "").splitlines()]
    candidates: list[str] = []

    for raw in lines[:500]:
        if len(raw) < 4 or len(raw) > 100:
            continue
        if raw.lower().startswith(("http://", "https://")):
            continue

        cleaned = re.sub(r"^[\-•*\d\.)\s]+", "", raw).strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        if len(cleaned) < 4 or len(cleaned) > 90:
            continue

        lower = cleaned.lower()
        looks_heading = bool(
            re.match(r"^(chapter|section|unit|topic)\b", lower)
            or re.match(r"^\d+(\.\d+)*\s+[a-zA-Z]", cleaned)
            or (len(cleaned.split()) <= 10 and cleaned[:1].isupper() and cleaned.count(".") <= 1)
        )
        if not looks_heading:
            continue

        if cleaned not in candidates:
            candidates.append(cleaned)

    return candidates[:12]


@router.post("/planner/create")
def create_plan(
    request: PlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request.user_id = current_user.id
    if not request.subjects:
        raise HTTPException(400, "At least one subject is required")

    normalized_subjects: List[SubjectInput] = []
    for subject in request.subjects:
        subject_name = (subject.subject or "").strip()
        if not subject_name:
            continue
        normalized_subjects.append(
            SubjectInput(
                subject=subject_name,
                exam_date=_parse_exam_date(subject.exam_date),
                weekly_hours=_parse_weekly_hours(subject.weekly_hours),
            )
        )

    if not normalized_subjects:
        raise HTTPException(400, "At least one valid subject is required")

    request.subjects = normalized_subjects

    unique_subjects = list(dict.fromkeys(s.subject.strip() for s in request.subjects if s.subject.strip()))
    if not unique_subjects:
        raise HTTPException(400, "At least one valid subject is required")

    db.query(StudyTask).filter(
        StudyTask.user_id == request.user_id,
        StudyTask.status == "pending",
    ).delete(synchronize_session=False)

    docs = (
        db.query(Document)
        .filter(Document.subject.in_(unique_subjects))
        .all()
    )
    docs_by_subject = {subject: [] for subject in unique_subjects}
    for d in docs:
        docs_by_subject.setdefault(d.subject, []).append(d)

    weak_rows = (
        db.query(WeakTopic, Document)
        .join(Document, Document.id == WeakTopic.document_id)
        .filter(WeakTopic.user_id == request.user_id)
        .filter(Document.subject.in_(unique_subjects))
        .all()
    )
    weakness_by_subject = {subject: 0.0 for subject in unique_subjects}
    weakness_count_by_subject = {subject: 0 for subject in unique_subjects}
    weak_topics_by_subject = {subject: [] for subject in unique_subjects}
    for weak, doc in weak_rows:
        weakness_by_subject[doc.subject] = weakness_by_subject.get(doc.subject, 0.0) + (weak.weakness_score or 0.0)
        weakness_count_by_subject[doc.subject] = weakness_count_by_subject.get(doc.subject, 0) + 1
        if weak.topic and weak.topic not in weak_topics_by_subject.setdefault(doc.subject, []):
            weak_topics_by_subject[doc.subject].append(weak.topic)

    for subject in unique_subjects:
        count = weakness_count_by_subject.get(subject, 0)
        if count > 0:
            weakness_by_subject[subject] = weakness_by_subject[subject] / count

    plan = StudyPlan(
        id=str(uuid.uuid4()),
        user_id=request.user_id,
        title=request.title,
        metadata_json={
            "subjects": [s.model_dump(mode="json") for s in request.subjects],
            "allocation": {},
        },
    )
    db.add(plan)

    today = datetime.date.today()

    base_hours_total = sum(max(1.0, s.weekly_hours) for s in request.subjects)
    size_weights = {}
    for subject in unique_subjects:
        chunk_sum = sum(max(1, d.chunk_count or 0) for d in docs_by_subject.get(subject, []))
        if chunk_sum <= 0:
            chunk_sum = 8
        weak_multiplier = 1.0 + min(1.5, max(0.0, weakness_by_subject.get(subject, 0.0)) * 1.6)
        size_weights[subject] = chunk_sum * weak_multiplier

    total_weight = sum(size_weights.values()) or float(len(unique_subjects))

    allocation = {}
    for subject in unique_subjects:
        allocation[subject] = {
            "weight": round(size_weights[subject], 3),
            "weakness_score": round(weakness_by_subject.get(subject, 0.0), 3),
            "chunk_size": int(sum(max(1, d.chunk_count or 0) for d in docs_by_subject.get(subject, [])) or 8),
            "adjusted_weekly_hours": round(base_hours_total * (size_weights[subject] / total_weight), 2),
        }
    plan.metadata_json = {
        "subjects": [s.model_dump(mode="json") for s in request.subjects],
        "allocation": allocation,
    }

    used_slots: set[str] = set()

    for subject_index, subject in enumerate(request.subjects):
        subject_name = subject.subject.strip()
        if not subject_name:
            continue

        subject_docs = docs_by_subject.get(subject_name, [])
        doc_topics = []
        for doc in subject_docs:
            extracted_topics = _extract_topics_from_text(doc.extracted_text or "")
            for topic_label in extracted_topics:
                if topic_label and topic_label not in doc_topics:
                    doc_topics.append(topic_label)

            fallback_topic = (doc.topic or "").strip()
            if fallback_topic and fallback_topic not in doc_topics:
                doc_topics.append(fallback_topic)
        weak_topics = weak_topics_by_subject.get(subject_name, [])
        topic_cycle = weak_topics + [t for t in doc_topics if t not in weak_topics]

        days_left = max((subject.exam_date - today).days, 1)
        weeks_left = max(1, int(math.ceil(days_left / 7)))
        weekly_hours = max(1.0, float(subject.weekly_hours))
        # Make exam proximity matter: closer exams get a modest intensity boost.
        urgency_boost = 1.0 + max(0.0, (21 - min(days_left, 21)) / 21) * 0.35
        total_minutes_budget = int(weekly_hours * 60 * weeks_left * urgency_boost)
        session_minutes = 90
        total_sessions = max(1, int(round(total_minutes_budget / session_minutes)))
        spacing_days = max(1, int(round(days_left / max(1, total_sessions))))
        base_minutes = int(max(45, min(120, session_minutes)))

        preferred_hours = [8, 9, 10, 11, 12, 14, 16, 18, 20]
        if subject_index % 2 == 1:
            preferred_hours = [10, 12, 9, 14, 8, 16, 20, 18, 11]

        subject_day_counts: dict[datetime.date, int] = {}
        max_subject_sessions_per_day = 2 if days_left <= 14 else 1

        def reserve_slot(target_day: datetime.date, session_idx: int) -> datetime.datetime | None:
            day_offsets = [0, -1, 1, -2, 2, -3, 3]
            for day_offset in day_offsets:
                candidate_day = target_day + datetime.timedelta(days=day_offset)
                if candidate_day < today or candidate_day > subject.exam_date:
                    continue
                if subject_day_counts.get(candidate_day, 0) >= max_subject_sessions_per_day:
                    continue
                for offset in range(len(preferred_hours)):
                    hour = preferred_hours[(session_idx + offset) % len(preferred_hours)]
                    due = datetime.datetime.combine(candidate_day, datetime.time(hour=hour))
                    key = due.isoformat()
                    if key not in used_slots:
                        used_slots.add(key)
                        subject_day_counts[candidate_day] = subject_day_counts.get(candidate_day, 0) + 1
                        return due

            search_day = target_day
            while search_day <= subject.exam_date:
                if subject_day_counts.get(search_day, 0) >= max_subject_sessions_per_day:
                    search_day = search_day + datetime.timedelta(days=1)
                    continue
                for offset in range(len(preferred_hours)):
                    hour = preferred_hours[(session_idx + offset) % len(preferred_hours)]
                    due = datetime.datetime.combine(search_day, datetime.time(hour=hour))
                    key = due.isoformat()
                    if key not in used_slots:
                        used_slots.add(key)
                        subject_day_counts[search_day] = subject_day_counts.get(search_day, 0) + 1
                        return due
                search_day = search_day + datetime.timedelta(days=1)
            return None

        topic_next_due: dict[str, datetime.date] = {}
        topic_gap_days: dict[str, int] = {}
        for session_index in range(total_sessions):
            focus_topic = topic_cycle[session_index % len(topic_cycle)] if topic_cycle else ""
            if session_index % 4 == 2:
                task_type = "spaced_repetition"
            elif session_index % 4 == 3:
                task_type = "quiz_revision"
            else:
                task_type = "study_block"

            # Fill days more consistently while still respecting exam horizon.
            window_days = min(days_left, max(1, total_sessions - 1))
            progress = session_index / max(1, (total_sessions - 1))
            target_offset = int(round(progress * window_days))
            target_day = today + datetime.timedelta(days=target_offset)

            # Spaced repetition should constrain only the current topic, not the whole subject.
            if task_type == "spaced_repetition" and focus_topic:
                next_due_for_topic = topic_next_due.get(focus_topic, today)
                if target_day < next_due_for_topic:
                    target_day = next_due_for_topic

                current_gap = topic_gap_days.get(focus_topic, max(1, spacing_days))
                topic_next_due[focus_topic] = target_day + datetime.timedelta(days=current_gap)
                topic_gap_days[focus_topic] = min(14, max(1, current_gap * 2))

            due_date = reserve_slot(target_day, session_index)
            if not due_date:
                break

            db.add(StudyTask(
                id=str(uuid.uuid4()),
                plan_id=plan.id,
                user_id=request.user_id,
                subject=subject_name,
                task_type=f"{task_type}::{focus_topic}" if focus_topic else task_type,
                due_date=due_date,
                estimated_minutes=base_minutes,
                spaced_interval_days=spacing_days if task_type == "spaced_repetition" else 0,
                status="pending",
            ))

    db.commit()
    return {"plan_id": plan.id, "status": "created"}

class CustomTaskInput(BaseModel):
    due_date: datetime.datetime
    label: str

@router.post("/planner/tasks/custom")
def save_custom_task(
    data: CustomTaskInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔥 FIX: Find ANY pending task at this exact time (AI generated or custom)
    existing_tasks = db.query(StudyTask).filter(
        StudyTask.user_id == current_user.id,
        StudyTask.due_date == data.due_date,
        StudyTask.status == "pending"
    ).all()

    label_clean = data.label.strip()

    # If the user cleared the input, delete ALL tasks at this time
    if not label_clean:
        for t in existing_tasks:
            db.delete(t)
        db.commit()
        return {"status": "deleted"}

    # If tasks exist, update the first one and delete duplicates (if any stacked up)
    if existing_tasks:
        target = existing_tasks[0]
        for t in existing_tasks[1:]:
            db.delete(t)
            
        target.subject = "Custom"
        target.task_type = f"custom::{label_clean}"
        db.commit()
        return {"status": "updated"}

    # Otherwise, create a new persistent custom task
    new_task = StudyTask(
        id=str(uuid.uuid4()),
        plan_id="custom",
        user_id=current_user.id,
        subject="Custom",
        task_type=f"custom::{label_clean}",
        due_date=data.due_date,
        estimated_minutes=60,
        spaced_interval_days=0,
        status="pending"
    )
    db.add(new_task)
    db.commit()
    return {"status": "created"}

@router.get("/planner/tasks")
def get_tasks(user_id: str = "", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    tasks = (
        db.query(StudyTask)
        .filter(StudyTask.user_id == user_id)
        .order_by(StudyTask.due_date.asc())
        .all()
    )

    weak = (
        db.query(WeakTopic)
        .filter(WeakTopic.user_id == user_id)
        .order_by(WeakTopic.weakness_score.desc())
        .limit(10)
        .all()
    )

    docs = db.query(Document).all()
    subject_stats = {}
    for d in docs:
        s = subject_stats.setdefault(d.subject or "General", {"subject": d.subject or "General", "documents": 0, "chunks": 0, "topics": set()})
        s["documents"] += 1
        s["chunks"] += int(d.chunk_count or 0)
        if d.topic:
            s["topics"].add(d.topic)

    activity_rows = (
        db.query(func.date(StudyTask.created_at), func.count(StudyTask.id))
        .filter(StudyTask.user_id == user_id)
        .group_by(func.date(StudyTask.created_at))
        .all()
    )
    completion_rows = (
        db.query(func.date(StudyTask.due_date), func.count(StudyTask.id))
        .filter(StudyTask.user_id == user_id, StudyTask.status == "completed")
        .group_by(func.date(StudyTask.due_date))
        .all()
    )
    upload_rows = (
        db.query(func.date(Document.created_at), func.count(Document.id))
        .group_by(func.date(Document.created_at))
        .all()
    )
    quiz_rows = (
        db.query(func.date(QuizAttempt.created_at), func.count(QuizAttempt.id))
        .group_by(func.date(QuizAttempt.created_at))
        .all()
    )
    chat_rows = (
        db.query(func.date(ChatHistory.created_at), func.count(ChatHistory.id))
        .group_by(func.date(ChatHistory.created_at))
        .all()
    )

    heatmap = {}
    for day, count in activity_rows:
        heatmap[str(day)] = heatmap.get(str(day), 0) + int(count or 0)
    for day, count in completion_rows:
        heatmap[str(day)] = heatmap.get(str(day), 0) + int(count or 0)
    for day, count in upload_rows:
        heatmap[str(day)] = heatmap.get(str(day), 0) + int(count or 0)
    for day, count in quiz_rows:
        heatmap[str(day)] = heatmap.get(str(day), 0) + int(count or 0)
    for day, count in chat_rows:
        heatmap[str(day)] = heatmap.get(str(day), 0) + int(count or 0)

    return {
        "tasks": [
            (lambda _t: {
                "id": _t.id,
                "subject": _t.subject,
                "task_type": (_t.task_type.split("::", 1)[0] if "::" in (_t.task_type or "") else _t.task_type),
                "focus_topic": (_t.task_type.split("::", 1)[1] if "::" in (_t.task_type or "") else ""),
                "due_date": str(_t.due_date),
                "start_time": str(_t.due_date),
                "end_time": str(_t.due_date + datetime.timedelta(minutes=_t.estimated_minutes)),
                "estimated_minutes": _t.estimated_minutes,
                "status": _t.status,
            })(t)
            for t in tasks
        ],
        "weak_topics": [
            {
                "topic": w.topic,
                "document_id": w.document_id,
                "weakness_score": w.weakness_score,
                "wrong_attempts": w.wrong_attempts,
            }
            for w in weak
        ],
        "available_subjects": [
            {
                "subject": v["subject"],
                "documents": v["documents"],
                "chunks": v["chunks"],
                "topics": sorted(list(v["topics"])),
            }
            for v in subject_stats.values()
        ],
        "activity_heatmap": [
            {"date": day, "count": count}
            for day, count in sorted(heatmap.items())
        ],
    }


@router.post("/planner/tasks/{task_id}/complete")
def complete_task(task_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if task.user_id != current_user.id:
        raise HTTPException(403, "Not allowed")

    task.status = "completed"

    if task.spaced_interval_days:
        next_due = task.due_date + datetime.timedelta(days=task.spaced_interval_days * 2)
        focus_topic = ""
        if task.task_type and "::" in task.task_type:
            focus_topic = task.task_type.split("::", 1)[1]
        db.add(StudyTask(
            id=str(uuid.uuid4()),
            plan_id=task.plan_id,
            user_id=task.user_id,
            subject=task.subject,
            task_type=f"spaced_repetition::{focus_topic}" if focus_topic else "spaced_repetition",
            due_date=next_due,
            estimated_minutes=max(15, int(task.estimated_minutes * 0.7)),
            spaced_interval_days=task.spaced_interval_days * 2,
            status="pending",
        ))

    db.commit()
    return {"status": "completed", "task_id": task_id}


@router.delete("/planner/tasks")
def clear_tasks(
    include_completed: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task_query = db.query(StudyTask).filter(StudyTask.user_id == current_user.id)
    if not include_completed:
        task_query = task_query.filter(StudyTask.status == "pending")

    deleted_tasks = task_query.delete(synchronize_session=False)
    deleted_plans = db.query(StudyPlan).filter(StudyPlan.user_id == current_user.id).delete(
        synchronize_session=False
    )
    db.commit()

    return {
        "status": "cleared",
        "deleted_tasks": deleted_tasks,
        "deleted_plans": deleted_plans,
    }
