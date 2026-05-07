import os
import secrets
import shutil
import uuid as _uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from database import get_db
from models import User, EmailVerificationToken
from auth import hash_password, verify_password, create_access_token
from deps import get_current_user
from email_service import send_verification_email

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

VERIFY_TOKEN_TTL_HOURS  = 24
RESEND_RATE_WINDOW_MIN  = 30
RESEND_RATE_MAX_TOKENS  = 3
# In dev (EMAIL_BACKEND=console) we expose the verification URL in the API
# response so a developer/tester doesn't have to read container logs to grab it.
EXPOSE_DEV_LINK = (os.getenv("EMAIL_BACKEND", "console").lower() == "console")


def _user_dict(u):
    return {
        "id":         u.id,
        "email":      u.email,
        "name":       u.name,
        "role":       u.role,
        "city":       u.city,
        "latitude":   u.latitude,
        "longitude":  u.longitude,
        "avatar_url": u.avatar_url,
        "email_verified": u.email_verified_at is not None,
        "created_at": str(u.created_at) if u.created_at else None,
    }


def _create_verification_token(db: Session, user: User) -> EmailVerificationToken:
    """Generate, persist, and return a fresh verification token for the user."""
    tok = EmailVerificationToken(
        token       = secrets.token_urlsafe(32),
        user_id     = user.id,
        purpose     = "verification",
        expires_at  = datetime.now(timezone.utc) + timedelta(hours=VERIFY_TOKEN_TTL_HOURS),
    )
    db.add(tok)
    db.commit()
    db.refresh(tok)
    return tok


class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verification email. Failures here are logged but don't block registration —
    # the user can resend from the dashboard if it doesn't arrive.
    dev_link: Optional[str] = None
    try:
        tok = _create_verification_token(db, user)
        link = send_verification_email(user, tok.token)
        if EXPOSE_DEV_LINK:
            dev_link = link
    except Exception as e:
        print(f"[register] failed to send verification email: {e}")

    resp = {
        "access_token": create_access_token({"sub": str(user.id)}),
        "user": _user_dict(user),
    }
    if dev_link:
        resp["dev_verification_link"] = dev_link
    return resp


# ── Email verification ───────────────────────────────────────────────────────
class VerifyEmailBody(BaseModel):
    token: str


@router.post("/verify-email")
def verify_email(body: VerifyEmailBody, db: Session = Depends(get_db)):
    """Consume a verification token and mark the user as verified.
    Idempotent: a previously-used token returns 200 if the user is already verified."""
    tok = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == body.token,
        EmailVerificationToken.purpose == "verification",
    ).first()
    if tok is None:
        raise HTTPException(400, "Invalid or unknown verification token")
    if tok.expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Verification token has expired — please request a new one")

    user = db.query(User).filter(User.id == tok.user_id).first()
    if user is None:
        raise HTTPException(400, "Account no longer exists")

    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)
    if tok.used_at is None:
        tok.used_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return {"verified": True, "user": _user_dict(user)}


@router.post("/resend-verification")
def resend_verification(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Issue a new verification email to the logged-in user."""
    if current_user.email_verified_at is not None:
        raise HTTPException(400, "Email is already verified")

    # Rate limit: cap recent verification tokens per user
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=RESEND_RATE_WINDOW_MIN)
    recent = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == current_user.id,
        EmailVerificationToken.created_at >= cutoff,
    ).count()
    if recent >= RESEND_RATE_MAX_TOKENS:
        raise HTTPException(
            429,
            f"Too many verification emails recently. Try again in "
            f"{RESEND_RATE_WINDOW_MIN} minutes.",
        )

    tok = _create_verification_token(db, current_user)
    link = send_verification_email(current_user, tok.token)
    resp = {"sent": True}
    if EXPOSE_DEV_LINK:
        resp["dev_verification_link"] = link
    return resp


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account is blocked")
    return {
        "access_token": create_access_token({"sub": str(user.id)}),
        "user": _user_dict(user),
    }


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return _user_dict(current_user)


class UpdateMeBody(BaseModel):
    name:      Optional[str]      = None
    email:     Optional[EmailStr] = None
    city:      Optional[str]      = None
    latitude:  Optional[float]    = None
    longitude: Optional[float]    = None


@router.patch("/me")
def update_me(
    body: UpdateMeBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.name is not None:
        new_name = body.name.strip()
        if not new_name:
            raise HTTPException(400, "Name cannot be empty")
        current_user.name = new_name

    if body.email is not None and body.email != current_user.email:
        existing = db.query(User).filter(User.email == body.email).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(400, "Email already registered")
        current_user.email = body.email

    if body.city is not None:
        current_user.city = body.city.strip() or None

    if body.latitude is not None:
        if not -90 <= body.latitude <= 90:
            raise HTTPException(400, "Latitude must be between -90 and 90")
        current_user.latitude = body.latitude

    if body.longitude is not None:
        if not -180 <= body.longitude <= 180:
            raise HTTPException(400, "Longitude must be between -180 and 180")
        current_user.longitude = body.longitude

    db.commit()
    db.refresh(current_user)

    # invalidate cached weather for this user across both caches
    # (Dashboard widget reads weather._cache; outfit recommend uses outfits._wcache)
    try:
        from routers.outfits import _wcache
        _wcache.pop(current_user.id, None)
    except Exception:
        pass
    try:
        from routers.weather import _cache as _weather_cache
        _weather_cache.pop(current_user.id, None)
    except Exception:
        pass

    return _user_dict(current_user)


class DeleteMeBody(BaseModel):
    password: str


@router.delete("/me")
def delete_me(
    body: DeleteMeBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(400, "Password is incorrect")

    # invalidate weather caches before delete (uid won't exist after)
    try:
        from routers.outfits import _wcache
        _wcache.pop(current_user.id, None)
    except Exception:
        pass
    try:
        from routers.weather import _cache as _weather_cache
        _weather_cache.pop(current_user.id, None)
    except Exception:
        pass

    db.delete(current_user)  # cascade removes items, outfits, ml_logs, preferences
    db.commit()
    return {"ok": True}


@router.post("/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(400, "Unsupported image format")

    filename = f"avatar_{current_user.id}_{_uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # remove old avatar file (best-effort)
    if current_user.avatar_url and current_user.avatar_url.startswith("/uploads/"):
        old = UPLOAD_DIR / current_user.avatar_url.split("/", 2)[-1]
        try:
            old.unlink(missing_ok=True)
        except Exception:
            pass

    current_user.avatar_url = f"/uploads/{filename}"
    db.commit()
    db.refresh(current_user)
    return _user_dict(current_user)


@router.delete("/avatar")
def remove_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.avatar_url and current_user.avatar_url.startswith("/uploads/"):
        old = UPLOAD_DIR / current_user.avatar_url.split("/", 2)[-1]
        try:
            old.unlink(missing_ok=True)
        except Exception:
            pass
    current_user.avatar_url = None
    db.commit()
    return {"ok": True}


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password:     str
    confirm_password: str


@router.patch("/password")
def change_password(
    body: ChangePasswordBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    if body.new_password != body.confirm_password:
        raise HTTPException(400, "Passwords do not match")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
