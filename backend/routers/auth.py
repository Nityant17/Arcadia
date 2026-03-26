"""
Auth Router — local auth, email OTP verification, and OAuth sign-in.
"""
import hashlib
import hmac
import secrets
import smtplib
import uuid
from datetime import datetime, timedelta
from email.message import EmailMessage
from urllib.parse import urlencode, quote_plus

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import (
    AUTH_EMAIL_OTP_EXPIRES_MINUTES,
    AUTH_FRONTEND_URL,
    AUTH_REQUIRE_EMAIL_VERIFICATION,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_SCOPES,
    MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET,
    MICROSOFT_OAUTH_SCOPES,
    MICROSOFT_TENANT_ID,
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USE_TLS,
    SMTP_USERNAME,
)
from models.database import EmailVerificationCode, User, UserSession, get_db
from services.streak_service import record_daily_login

router = APIRouter()

_OAUTH_STATE_TTL_MINUTES = 10
_oauth_state_store: dict[str, dict] = {}


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)


class VerifyEmailRequest(BaseModel):
    email: str
    otp: str = Field(min_length=4, max_length=12)


class ResendOtpRequest(BaseModel):
    email: str


class AuthResponse(BaseModel):
    user_id: str
    name: str
    email: str
    token: str = ""
    verification_required: bool = False
    message: str = ""
    auth_provider: str = "local"
    dev_otp: str | None = None
    streak: int = 0
    new_star: bool = False


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _hash_otp(email: str, otp: str) -> str:
    payload = f"{email.lower().strip()}::{otp.strip()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _extract_bearer_token(authorization: str) -> str:
    if not authorization:
        raise HTTPException(401, "Missing Authorization header")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(401, "Invalid Authorization header format")
    token = parts[1].strip()
    if not token:
        raise HTTPException(401, "Missing bearer token")
    return token


def _create_user_session(db: Session, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        UserSession(
            id=str(uuid.uuid4()),
            user_id=user_id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
    )
    return token


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _send_email_otp(email: str, name: str, otp: str) -> bool:
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD:
        print(f"[AUTH] OTP for {email}: {otp}")
        return False

    message = EmailMessage()
    message["Subject"] = "Arcadia verification code"
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = email
    message.set_content(
        f"Hi {name or 'there'},\n\n"
        f"Your Arcadia verification code is: {otp}\n"
        f"This code expires in {AUTH_EMAIL_OTP_EXPIRES_MINUTES} minutes.\n\n"
        "If you did not request this, you can ignore this email."
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
        if SMTP_USE_TLS:
            smtp.starttls()
        smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message)

    return True


def _issue_email_otp(db: Session, user: User) -> tuple[str, bool]:
    otp = _generate_otp()
    now = datetime.utcnow()

    db.query(EmailVerificationCode).filter(
        EmailVerificationCode.user_id == user.id,
        EmailVerificationCode.used_at.is_(None),
    ).update({"used_at": now}, synchronize_session=False)

    db.add(
        EmailVerificationCode(
            id=str(uuid.uuid4()),
            user_id=user.id,
            email=user.email,
            code_hash=_hash_otp(user.email, otp),
            expires_at=now + timedelta(minutes=AUTH_EMAIL_OTP_EXPIRES_MINUTES),
        )
    )

    sent = _send_email_otp(user.email, user.name, otp)
    return otp, sent


def _cleanup_oauth_states() -> None:
    now = datetime.utcnow()
    stale = [
        state
        for state, payload in _oauth_state_store.items()
        if payload.get("expires_at") and payload["expires_at"] < now
    ]
    for state in stale:
        _oauth_state_store.pop(state, None)


def _create_oauth_state(provider: str) -> str:
    _cleanup_oauth_states()
    state = secrets.token_urlsafe(24)
    _oauth_state_store[state] = {
        "provider": provider,
        "expires_at": datetime.utcnow() + timedelta(minutes=_OAUTH_STATE_TTL_MINUTES),
    }
    return state


def _consume_oauth_state(state: str, provider: str) -> bool:
    payload = _oauth_state_store.pop(state, None)
    if not payload:
        return False
    if payload.get("provider") != provider:
        return False
    if payload.get("expires_at") and payload["expires_at"] < datetime.utcnow():
        return False
    return True


def _oauth_callback_url(request: Request, provider: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/auth/oauth/{provider}/callback"


def _oauth_error_redirect(message: str) -> RedirectResponse:
    target = f"{AUTH_FRONTEND_URL.rstrip('/')}/auth?oauth_error={quote_plus(message)}"
    return RedirectResponse(target)


def get_current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_bearer_token(authorization)
    session = db.query(UserSession).filter(UserSession.token == token).first()
    if not session or (session.expires_at and session.expires_at < datetime.utcnow()):
        raise HTTPException(401, "Invalid or expired token")

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(401, "Invalid session")
    return user


@router.post("/auth/register", response_model=AuthResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(409, "Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        name=req.name.strip(),
        email=email,
        password_hash=_hash_password(req.password),
        email_verified=not AUTH_REQUIRE_EMAIL_VERIFICATION,
        auth_provider="local",
        provider_subject="",
    )
    db.add(user)
    db.flush()

    if AUTH_REQUIRE_EMAIL_VERIFICATION:
        otp, sent = _issue_email_otp(db, user)
        db.commit()
        return AuthResponse(
            user_id=user.id,
            name=user.name,
            email=user.email,
            token="",
            verification_required=True,
            message="Verification code sent to your email",
            auth_provider="local",
            dev_otp=None if sent else otp,
        )

    token = _create_user_session(db, user.id)
    streak, new_star = record_daily_login(db, user.id)
    db.commit()
    return AuthResponse(
        user_id=user.id,
        name=user.name,
        email=user.email,
        token=token,
        verification_required=False,
        message="Account created",
        auth_provider="local",
        streak=streak.current_streak or 0,
        new_star=new_star,
    )


@router.post("/auth/verify-email", response_model=AuthResponse)
def verify_email(req: VerifyEmailRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, "Account not found")

    otp_row = (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.user_id == user.id,
            EmailVerificationCode.used_at.is_(None),
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )
    if not otp_row:
        raise HTTPException(400, "No active verification code. Request a new OTP.")
    if otp_row.expires_at < datetime.utcnow():
        raise HTTPException(400, "Verification code expired. Request a new OTP.")

    expected = otp_row.code_hash or ""
    provided = _hash_otp(email, req.otp)
    if not hmac.compare_digest(expected, provided):
        raise HTTPException(401, "Invalid verification code")

    otp_row.used_at = datetime.utcnow()
    user.email_verified = True
    token = _create_user_session(db, user.id)
    streak, new_star = record_daily_login(db, user.id)
    db.commit()

    return AuthResponse(
        user_id=user.id,
        name=user.name,
        email=user.email,
        token=token,
        verification_required=False,
        message="Email verified",
        auth_provider=user.auth_provider or "local",
        streak=streak.current_streak or 0,
        new_star=new_star,
    )


@router.post("/auth/resend-otp")
def resend_otp(req: ResendOtpRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(404, "Account not found")
    if user.auth_provider != "local":
        raise HTTPException(400, "This account signs in with OAuth provider")
    if user.email_verified:
        return {"status": "already_verified"}

    otp, sent = _issue_email_otp(db, user)
    db.commit()
    return {
        "status": "otp_sent",
        "email": user.email,
        "dev_otp": None if sent else otp,
    }


@router.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or user.password_hash != _hash_password(req.password):
        raise HTTPException(401, "No account found with those credentials. Check email/password or create an account.")

    if (user.auth_provider or "local") != "local":
        raise HTTPException(401, f"This account uses {user.auth_provider} sign-in. Use OAuth login.")

    if AUTH_REQUIRE_EMAIL_VERIFICATION and not bool(user.email_verified):
        otp, sent = _issue_email_otp(db, user)
        db.commit()
        detail = "Email not verified. We sent a verification code."
        if not sent:
            detail = f"{detail} Dev OTP: {otp}"
        raise HTTPException(403, detail)

    token = _create_user_session(db, user.id)
    streak, new_star = record_daily_login(db, user.id)
    db.commit()

    return AuthResponse(
        user_id=user.id,
        name=user.name,
        email=user.email,
        token=token,
        verification_required=False,
        message="Signed in",
        auth_provider=user.auth_provider or "local",
        streak=streak.current_streak or 0,
        new_star=new_star,
    )


@router.get("/auth/oauth/{provider}/start")
def oauth_start(provider: str, request: Request):
    provider = (provider or "").strip().lower()
    if provider not in {"google", "microsoft"}:
        raise HTTPException(404, "Unsupported provider")

    state = _create_oauth_state(provider)
    redirect_uri = _oauth_callback_url(request, provider)

    if provider == "google":
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            raise HTTPException(503, "Google OAuth is not configured")
        query = urlencode(
            {
                "client_id": GOOGLE_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": GOOGLE_OAUTH_SCOPES,
                "state": state,
                "access_type": "offline",
                "prompt": "select_account",
            }
        )
        return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{query}")

    if not MICROSOFT_CLIENT_ID or not MICROSOFT_CLIENT_SECRET:
        raise HTTPException(503, "Microsoft OAuth is not configured")

    query = urlencode(
        {
            "client_id": MICROSOFT_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "response_mode": "query",
            "scope": MICROSOFT_OAUTH_SCOPES,
            "state": state,
            "prompt": "select_account",
        }
    )
    return RedirectResponse(
        f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?{query}"
    )


async def _oauth_exchange_google(request: Request, code: str) -> dict:
    redirect_uri = _oauth_callback_url(request, "google")
    async with httpx.AsyncClient(timeout=25.0) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_resp.raise_for_status()
        token_payload = token_resp.json()
        access_token = token_payload.get("access_token", "")
        if not access_token:
            raise RuntimeError("Google access token missing")

        userinfo_resp = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        userinfo_resp.raise_for_status()
        profile = userinfo_resp.json()

    return {
        "provider_subject": str(profile.get("sub") or "").strip(),
        "email": str(profile.get("email") or "").strip().lower(),
        "name": str(profile.get("name") or profile.get("email") or "Arcadia User").strip(),
        "provider": "google",
    }


async def _oauth_exchange_microsoft(request: Request, code: str) -> dict:
    redirect_uri = _oauth_callback_url(request, "microsoft")
    async with httpx.AsyncClient(timeout=25.0) as client:
        token_resp = await client.post(
            f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/token",
            data={
                "client_id": MICROSOFT_CLIENT_ID,
                "client_secret": MICROSOFT_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "scope": MICROSOFT_OAUTH_SCOPES,
            },
        )
        token_resp.raise_for_status()
        token_payload = token_resp.json()
        access_token = token_payload.get("access_token", "")
        if not access_token:
            raise RuntimeError("Microsoft access token missing")

        me_resp = await client.get(
            "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        me_resp.raise_for_status()
        profile = me_resp.json()

    email = str(profile.get("mail") or profile.get("userPrincipalName") or "").strip().lower()
    return {
        "provider_subject": str(profile.get("id") or "").strip(),
        "email": email,
        "name": str(profile.get("displayName") or email or "Arcadia User").strip(),
        "provider": "microsoft",
    }


def _upsert_oauth_user(db: Session, profile: dict) -> User:
    provider = profile["provider"]
    provider_subject = profile["provider_subject"]
    email = profile["email"]
    name = profile["name"]

    user = None
    if provider_subject:
        user = (
            db.query(User)
            .filter(User.auth_provider == provider, User.provider_subject == provider_subject)
            .first()
        )

    if not user and email:
        user = db.query(User).filter(User.email == email).first()

    if user:
        user.name = name or user.name
        user.email = email or user.email
        user.email_verified = True
        user.auth_provider = provider
        user.provider_subject = provider_subject
        return user

    if not email:
        raise HTTPException(422, "OAuth provider did not return an email address")

    user = User(
        id=str(uuid.uuid4()),
        name=name or "Arcadia User",
        email=email,
        password_hash="",
        email_verified=True,
        auth_provider=provider,
        provider_subject=provider_subject,
    )
    db.add(user)
    db.flush()
    return user


@router.get("/auth/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    code: str = "",
    state: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    provider = (provider or "").strip().lower()
    if provider not in {"google", "microsoft"}:
        return _oauth_error_redirect("Unsupported OAuth provider")

    if error:
        return _oauth_error_redirect(error)
    if not code:
        return _oauth_error_redirect("Missing OAuth code")
    if not state or not _consume_oauth_state(state, provider):
        return _oauth_error_redirect("Invalid or expired OAuth state")

    try:
        if provider == "google":
            profile = await _oauth_exchange_google(request, code)
        else:
            profile = await _oauth_exchange_microsoft(request, code)

        user = _upsert_oauth_user(db, profile)
        token = _create_user_session(db, user.id)
        streak, new_star = record_daily_login(db, user.id)
        db.commit()

        params = urlencode(
            {
                "oauth_token": token,
                "oauth_name": user.name,
                "oauth_email": user.email,
                "oauth_provider": provider,
                "oauth_streak": streak.current_streak or 0,
                "oauth_new_star": "true" if new_star else "false",
            }
        )
        return RedirectResponse(f"{AUTH_FRONTEND_URL.rstrip('/')}/auth?{params}")
    except HTTPException as exc:
        return _oauth_error_redirect(str(exc.detail))
    except Exception as exc:
        return _oauth_error_redirect(f"OAuth login failed: {exc}")


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "auth_provider": user.auth_provider or "local",
        "email_verified": bool(user.email_verified),
    }
