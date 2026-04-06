import time
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import User, WardrobeItem, Outfit, Preference
from deps import get_current_user
from recommend import recommend_outfits

router = APIRouter(prefix="/api/v1/outfits", tags=["outfits"])

KEY = os.getenv("OPENWEATHER_API_KEY", "")
_wcache: dict = {}


async def _get_weather(user: User) -> dict:
    uid = user.id
    if uid in _wcache and time.time() - _wcache[uid][0] < 1800:
        return _wcache[uid][1]
    result = {"temp": 15, "feels_like": 15, "wind_speed": 0, "pop": 0}
    try:
        lat, lon = user.latitude, user.longitude
        if lat:
            async with httpx.AsyncClient(timeout=8.0) as c:
                d = (await c.get(
                    "https://api.openweathermap.org/data/2.5/weather",
                    params={"lat": lat, "lon": lon, "appid": KEY, "units": "metric"},
                )).json()
            result = {
                "temp": d["main"]["temp"],
                "feels_like": d["main"]["feels_like"],
                "wind_speed": d["wind"]["speed"],
                "pop": 0,
            }
    except Exception:
        pass
    _wcache[uid] = (time.time(), result)
    return result


@router.get("/recommend")
async def recommend(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = db.query(WardrobeItem).filter(WardrobeItem.user_id == user.id).all()
    prefs = db.query(Preference).filter(Preference.user_id == user.id).first()
    weather = await _get_weather(user)

    if not items:
        return {"outfits": [], "weather": weather, "message": "Add clothes first"}

    outfits = recommend_outfits(items, prefs, weather)
    return {"outfits": outfits, "weather": weather}


class OutfitBody(BaseModel):
    name: Optional[str] = None
    item_ids: str
    is_auto_generated: bool = True
    score: Optional[float] = None
    weather_temp: Optional[float] = None


@router.post("")
def save_outfit(
    body: OutfitBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    o = Outfit(
        user_id=user.id,
        name=body.name or "My Outfit",
        item_ids=body.item_ids,
        is_auto_generated=body.is_auto_generated,
        score=body.score,
        weather_temp=body.weather_temp,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return {"id": o.id}


@router.get("")
def list_outfits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    outfits = db.query(Outfit).filter(
        Outfit.user_id == user.id,
    ).order_by(Outfit.created_at.desc()).all()

    result = []
    for o in outfits:
        ids = [int(x) for x in o.item_ids.split(",") if x.strip().isdigit()]
        items = db.query(WardrobeItem).filter(WardrobeItem.id.in_(ids)).all()
        result.append({
            "id": o.id,
            "name": o.name,
            "score": o.score,
            "weather_temp": o.weather_temp,
            "is_auto_generated": o.is_auto_generated,
            "created_at": str(o.created_at),
            "items": [
                {
                    "id": i.id,
                    "name": i.name,
                    "image_url": i.image_url,
                    "image_no_bg_url": i.image_no_bg_url,
                    "category": i.category,
                }
                for i in items
            ],
        })
    return result


@router.delete("/{oid}")
def delete_outfit(
    oid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    o = db.query(Outfit).filter(Outfit.id == oid, Outfit.user_id == user.id).first()
    if not o:
        raise HTTPException(404, "Not found")
    db.delete(o)
    db.commit()
    return {"ok": True}
