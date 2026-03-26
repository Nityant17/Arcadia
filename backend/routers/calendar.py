import secrets
import uuid
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import AUTH_FRONTEND_URL, GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_SCOPES
from models.database import CalendarEventLink, StudyTask, UserCalendarToken, get_db
from routers.auth import get_current_user

router = APIRouter()

_calendar_state_store: dict[str, dict] = {}


class CalendarPushRequest(BaseModel):
    task_ids: list[str] | None = None


def _calendar_callback_url(request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/calendar/google/callback"


def _store_state(state: str, user_id: str) -> None:
    _calendar_state_store[state] = {
        "user_id": user_id,
        "created_at": datetime.utcnow(),
    }


def _consume_state(state: str) -> str | None:
    payload = _calendar_state_store.pop(state, None)
    if not payload:
        return None
    return payload.get("user_id")


def _get_calendar_token(db: Session, user_id: str) -> UserCalendarToken | None:
    return (
        db.query(UserCalendarToken)
        .filter(UserCalendarToken.user_id == user_id, UserCalendarToken.provider == "google")
        .first()
    )


async def _refresh_google_token(db: Session, token: UserCalendarToken) -> UserCalendarToken:
    if not token.refresh_token:
        raise HTTPException(401, "Google Calendar token expired. Reconnect calendar.")

    payload = {
        "client_id": GOOGLE_CALENDAR_CLIENT_ID,
        "client_secret": GOOGLE_CALENDAR_CLIENT_SECRET,
        "refresh_token": token.refresh_token,
        "grant_type": "refresh_token",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post("https://oauth2.googleapis.com/token", data=payload)
        response.raise_for_status()
        data = response.json()

    token.access_token = data.get("access_token", "")
    expires_in = int(data.get("expires_in", 3600))
    token.expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    db.commit()
    return token


async def _ensure_valid_token(db: Session, user_id: str) -> UserCalendarToken:
    token = _get_calendar_token(db, user_id)
    if not token or not token.access_token:
        raise HTTPException(404, "Google Calendar not connected")
    if token.expires_at and token.expires_at <= datetime.utcnow() + timedelta(seconds=30):
        token = await _refresh_google_token(db, token)
    return token


def _build_google_auth_url(request: Request, user_id: str) -> str:
    if not GOOGLE_CALENDAR_CLIENT_ID or not GOOGLE_CALENDAR_CLIENT_SECRET:
        raise HTTPException(503, "Google Calendar OAuth is not configured")

    state = secrets.token_urlsafe(24)
    _store_state(state, user_id)
    redirect_uri = _calendar_callback_url(request)

    params = urlencode(
        {
            "client_id": GOOGLE_CALENDAR_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": GOOGLE_CALENDAR_SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


@router.get("/calendar/google/url")
def google_calendar_url(request: Request, current_user=Depends(get_current_user)):
    url = _build_google_auth_url(request, current_user.id)
    return {"url": url}


@router.get("/calendar/google/start")
def google_calendar_start(request: Request, current_user=Depends(get_current_user)):
    url = _build_google_auth_url(request, current_user.id)
    return RedirectResponse(url)


@router.get("/calendar/google/callback")
async def google_calendar_callback(
    request: Request,
    code: str = "",
    state: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    if error:
        return RedirectResponse(f"{AUTH_FRONTEND_URL.rstrip('/')}/planner?calendar=google&error={error}")
    if not code:
        return RedirectResponse(f"{AUTH_FRONTEND_URL.rstrip('/')}/planner?calendar=google&error=missing_code")
    user_id = _consume_state(state)
    if not user_id:
        return RedirectResponse(f"{AUTH_FRONTEND_URL.rstrip('/')}/planner?calendar=google&error=invalid_state")

    redirect_uri = _calendar_callback_url(request)
    payload = {
        "client_id": GOOGLE_CALENDAR_CLIENT_ID,
        "client_secret": GOOGLE_CALENDAR_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post("https://oauth2.googleapis.com/token", data=payload)
        response.raise_for_status()
        data = response.json()

    access_token = data.get("access_token", "")
    refresh_token = data.get("refresh_token")
    expires_in = int(data.get("expires_in", 3600))
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

    token = _get_calendar_token(db, user_id)
    if not token:
        token = UserCalendarToken(
            id=str(uuid.uuid4()),
            user_id=user_id,
            provider="google",
        )
        db.add(token)

    token.access_token = access_token
    token.refresh_token = refresh_token or token.refresh_token
    token.expires_at = expires_at
    db.commit()

    return RedirectResponse(f"{AUTH_FRONTEND_URL.rstrip('/')}/planner?calendar=google&connected=1")


@router.get("/calendar/google/status")
def google_calendar_status(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    token = _get_calendar_token(db, current_user.id)
    return {"connected": bool(token and token.access_token)}


@router.post("/calendar/google/push")
async def google_calendar_push(
    payload: CalendarPushRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = await _ensure_valid_token(db, current_user.id)

    task_query = db.query(StudyTask).filter(
        StudyTask.user_id == current_user.id,
        StudyTask.status == "pending",
    )
    if payload.task_ids:
        task_query = task_query.filter(StudyTask.id.in_(payload.task_ids))

    tasks = task_query.all()
    created = 0
    skipped = 0

    async with httpx.AsyncClient(timeout=15) as client:
        for task in tasks:
            existing = (
                db.query(CalendarEventLink)
                .filter(
                    CalendarEventLink.user_id == current_user.id,
                    CalendarEventLink.provider == "google",
                    CalendarEventLink.task_id == task.id,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue

            start_dt = task.due_date
            if isinstance(start_dt, str):
                try:
                    start_dt = datetime.fromisoformat(start_dt)
                except ValueError:
                    start_dt = datetime.utcnow()

            end_dt = start_dt + timedelta(minutes=max(15, task.estimated_minutes or 30))

            event_payload = {
                "summary": f"Arcadia: {task.subject} · {task.task_type}",
                "description": f"Focus: {task.task_type} {task.subject}",
                "start": {"dateTime": start_dt.isoformat(), "timeZone": "UTC"},
                "end": {"dateTime": end_dt.isoformat(), "timeZone": "UTC"},
                "reminders": {
                    "useDefault": False,
                    "overrides": [{"method": "popup", "minutes": 30}],
                },
            }

            response = await client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers={"Authorization": f"Bearer {token.access_token}"},
                json=event_payload,
            )
            response.raise_for_status()
            event = response.json()
            event_id = event.get("id", "")
            if event_id:
                db.add(
                    CalendarEventLink(
                        id=str(uuid.uuid4()),
                        user_id=current_user.id,
                        provider="google",
                        task_id=task.id,
                        event_id=event_id,
                    )
                )
            created += 1

    db.commit()
    return {"status": "ok", "created": created, "skipped": skipped}
