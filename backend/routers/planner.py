"""
Planner Router — timetable + spaced repetition schedule.
"""
import datetime
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.database import get_db, StudyPlan, StudyTask, WeakTopic, Document
from models.database import User
from routers.auth import get_current_user

router = APIRouter()


class SubjectInput(BaseModel):
    subject: str
    exam_date: datetime.date
    weekly_hours: float = Field(default=4, ge=1, le=40)


class PlanRequest(BaseModel):
    user_id: str
    title: str = "Exam Study Plan"
    subjects: List[SubjectInput]


@router.post("/planner/create")
def create_plan(
    request: PlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request.user_id = current_user.id
    if not request.subjects:
        raise HTTPException(400, "At least one subject is required")

    unique_subjects = list({s.subject.strip() for s in request.subjects if s.subject.strip()})
    if not unique_subjects:
        raise HTTPException(400, "At least one valid subject is required")

    db.query(StudyTask).filter(
        StudyTask.user_id == request.user_id,
        StudyTask.status == "pending",
    ).delete(synchronize_session=False)

    docs = db.query(Document).filter(Document.subject.in_(unique_subjects)).all()
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
    for weak, doc in weak_rows:
        weakness_by_subject[doc.subject] = weakness_by_subject.get(doc.subject, 0.0) + (weak.weakness_score or 0.0)
        weakness_count_by_subject[doc.subject] = weakness_count_by_subject.get(doc.subject, 0) + 1

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

    for subject in request.subjects:
        subject_name = subject.subject.strip()
        if not subject_name:
            continue

        days_left = max((subject.exam_date - today).days, 1)
        subject_hours = allocation.get(subject_name, {}).get("adjusted_weekly_hours", subject.weekly_hours)
        sessions_per_week = max(2, int(round((subject_hours * 60) / 90)))
        total_sessions = max(3, int(round((days_left / 7) * sessions_per_week)))
        spacing_days = max(1, days_left // total_sessions)
        base_minutes = int(max(40, min(150, (subject_hours * 60) / sessions_per_week)))

        session_day = today
        session_index = 0
        while session_day <= subject.exam_date and session_index < total_sessions:
            slot_hour = [17, 19, 21][session_index % 3]
            task_type = "study_block" if (session_index % 3 != 2) else "quiz_revision"
            task = StudyTask(
                id=str(uuid.uuid4()),
                plan_id=plan.id,
                user_id=request.user_id,
                subject=subject_name,
                task_type=task_type,
                due_date=datetime.datetime.combine(session_day, datetime.time(hour=slot_hour)),
                estimated_minutes=base_minutes,
                spaced_interval_days=spacing_days,
                status="pending",
            )
            db.add(task)

            session_index += 1
            session_day = session_day + datetime.timedelta(days=spacing_days)

        weakness = allocation.get(subject_name, {}).get("weakness_score", 0.0)
        if weakness >= 0.35:
            booster_day = today + datetime.timedelta(days=2)
            while booster_day <= subject.exam_date:
                db.add(StudyTask(
                    id=str(uuid.uuid4()),
                    plan_id=plan.id,
                    user_id=request.user_id,
                    subject=subject_name,
                    task_type="weakness_booster",
                    due_date=datetime.datetime.combine(booster_day, datetime.time(hour=20)),
                    estimated_minutes=max(30, int(base_minutes * 0.6)),
                    spaced_interval_days=5,
                    status="pending",
                ))
                booster_day = booster_day + datetime.timedelta(days=5)

    db.commit()
    return {"plan_id": plan.id, "status": "created"}


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
    heatmap = {}
    for day, count in activity_rows:
        heatmap[str(day)] = heatmap.get(str(day), 0) + int(count or 0)
    for day, count in completion_rows:
        heatmap[str(day)] = heatmap.get(str(day), 0) + int(count or 0)

    return {
        "tasks": [
            {
                "id": t.id,
                "subject": t.subject,
                "task_type": t.task_type,
                "due_date": str(t.due_date),
                "start_time": str(t.due_date),
                "end_time": str(t.due_date + datetime.timedelta(minutes=t.estimated_minutes)),
                "estimated_minutes": t.estimated_minutes,
                "status": t.status,
            }
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
        db.add(StudyTask(
            id=str(uuid.uuid4()),
            plan_id=task.plan_id,
            user_id=task.user_id,
            subject=task.subject,
            task_type="spaced_repetition",
            due_date=next_due,
            estimated_minutes=max(15, int(task.estimated_minutes * 0.7)),
            spaced_interval_days=task.spaced_interval_days * 2,
            status="pending",
        ))

    db.commit()
    return {"status": "completed", "task_id": task_id}
