from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import User, Preference, Style, Colour
from deps import get_current_user

router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


def _get_or_create(db: Session, model, name: str):
    name = name.strip().lower()
    obj = db.query(model).filter_by(name=name).first()
    if not obj:
        obj = model(name=name)
        db.add(obj)
        db.flush()
    return obj


def _parse_names(s: Optional[str]) -> list:
    if not s:
        return []
    return [n.strip() for n in s.split(",") if n.strip()]


class PrefBody(BaseModel):
    styles:           Optional[str] = None   # comma-separated style names
    favorite_colors:  Optional[str] = None   # comma-separated colour names
    disliked_colors:  Optional[str] = None
    heat_sensitivity: str           = "normal"
    allow_layering:   bool          = True


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
        "styles":           ",".join(s.name for s in p.styles),
        "favorite_colors":  ",".join(c.name for c in p.favourite_colours),
        "disliked_colors":  ",".join(c.name for c in p.disliked_colours),
        "heat_sensitivity": p.heat_sensitivity,
        "allow_layering":   p.allow_layering,
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
        db.flush()

    p.heat_sensitivity = body.heat_sensitivity
    p.allow_layering   = body.allow_layering

    # Sync styles
    p.styles.clear()
    for name in _parse_names(body.styles):
        p.styles.append(_get_or_create(db, Style, name))

    # Sync favourite colours
    p.favourite_colours.clear()
    for name in _parse_names(body.favorite_colors):
        p.favourite_colours.append(_get_or_create(db, Colour, name))

    # Sync disliked colours
    p.disliked_colours.clear()
    for name in _parse_names(body.disliked_colors):
        p.disliked_colours.append(_get_or_create(db, Colour, name))

    db.commit()
    return {"ok": True}
