from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from database import get_db
from models import User
from auth import hash_password, verify_password, create_access_token
from deps import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _user_dict(u):
    return {"id": u.id, "email": u.email, "name": u.name, "role": u.role, "city": u.city}


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
    return {
        "access_token": create_access_token({"sub": str(user.id)}),
        "user": _user_dict(user),
    }


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
    name:  Optional[str]      = None
    email: Optional[EmailStr] = None


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

    db.commit()
    db.refresh(current_user)
    return _user_dict(current_user)


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
