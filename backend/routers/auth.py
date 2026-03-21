"""
Auth Router — simple user register/login with session token.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session

from models.database import get_db, User, UserSession
from pydantic import BaseModel, Field

router = APIRouter()


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)


class AuthResponse(BaseModel):
    user_id: str
    name: str
    email: str
    token: str


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


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
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(409, "Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        name=req.name.strip(),
        email=req.email.lower(),
        password_hash=_hash_password(req.password),
    )
    db.add(user)

    token = secrets.token_urlsafe(32)
    session = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    db.add(session)
    db.commit()

    return AuthResponse(user_id=user.id, name=user.name, email=user.email, token=token)


@router.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or user.password_hash != _hash_password(req.password):
        raise HTTPException(401, "Invalid email or password")

    token = secrets.token_urlsafe(32)
    session = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    db.add(session)
    db.commit()

    return AuthResponse(user_id=user.id, name=user.name, email=user.email, token=token)


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return {"user_id": user.id, "name": user.name, "email": user.email}
