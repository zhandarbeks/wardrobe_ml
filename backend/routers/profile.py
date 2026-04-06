from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import User, Preference
from deps import get_current_user

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


class PrefBody(BaseModel):
    styles: Optional[str] = None
    favorite_colors: Optional[str] = None
    disliked_colors: Optional[str] = None
    heat_sensitivity: str = "normal"
    allow_layering: bool = True


@router.get("/preferences")
def get_prefs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = db.query(Preference).filter(Preference.user_id == user.id).first()
    if not p:
        return {
            "styles": "", "favorite_colors": "", "disliked_colors": "",
            "heat_sensitivity": "normal", "allow_layering": True,
        }
    return {
        "styles": p.styles or "",
        "favorite_colors": p.favorite_colors or "",
        "disliked_colors": p.disliked_colors or "",
        "heat_sensitivity": p.heat_sensitivity,
        "allow_layering": p.allow_layering,
    }


@router.put("/preferences")
def save_prefs(
    body: PrefBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = db.query(Preference).filter(Preference.user_id == user.id).first()
    if not p:
        p = Preference(user_id=user.id)
        db.add(p)
    p.styles = body.styles
    p.favorite_colors = body.favorite_colors
    p.disliked_colors = body.disliked_colors
    p.heat_sensitivity = body.heat_sensitivity
    p.allow_layering = body.allow_layering
    db.commit()
    return {"ok": True}
