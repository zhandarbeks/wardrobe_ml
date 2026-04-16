import time
import os
import uuid as _uuid
import httpx

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import User, WardrobeItem, Outfit, OutfitItem, Preference, Layer
from deps import get_current_user
from recommend import recommend_outfits, ml_rescore_outfits

router = APIRouter(prefix="/api/v1/outfits", tags=["outfits"])

KEY    = os.getenv("OPENWEATHER_API_KEY", "")
ML_URL = os.getenv("ML_SERVICE_URL", "http://ml-service:8001")
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
                "temp":       d["main"]["temp"],
                "feels_like": d["main"]["feels_like"],
                "wind_speed": d["wind"]["speed"],
                "pop":        0,
            }
    except Exception:
        pass
    _wcache[uid] = (time.time(), result)
    return result


def _load_items(db: Session, user_id):
    from models import Category, Colour
    return (
        db.query(WardrobeItem)
        .options(
            joinedload(WardrobeItem.category_ref),
            joinedload(WardrobeItem.colour_ref),
            joinedload(WardrobeItem.material_ref),
            joinedload(WardrobeItem.styles),
        )
        .filter(WardrobeItem.user_id == user_id)
        .all()
    )


@router.get("/recommend")
async def recommend(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items   = _load_items(db, user.id)
    prefs   = db.query(Preference).filter(Preference.user_id == user.id).first()
    weather = await _get_weather(user)

    if not items:
        return {"outfits": [], "weather": weather, "message": "Add clothes first"}

    outfits = recommend_outfits(items, prefs, weather)
    outfits = await ml_rescore_outfits(outfits, ML_URL)
    return {"outfits": outfits, "weather": weather}


class OutfitBody(BaseModel):
    name:             Optional[str]   = None
    item_ids:         str                     # comma-separated UUID strings
    is_auto_generated: bool           = True
    score:            Optional[float] = None
    weather_temp:     Optional[float] = None


@router.post("")
def save_outfit(
    body: OutfitBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    outfit = Outfit(
        user_id           = user.id,
        name              = body.name or "My Outfit",
        is_auto_generated = body.is_auto_generated,
        score             = body.score,
        weather_temp      = body.weather_temp,
    )
    db.add(outfit)
    db.flush()

    used_layers: set = set()
    for id_str in body.item_ids.split(","):
        id_str = id_str.strip()
        if not id_str:
            continue
        try:
            item_uuid = _uuid.UUID(id_str)
        except ValueError:
            continue
        item = (
            db.query(WardrobeItem)
            .options(joinedload(WardrobeItem.category_ref))
            .filter(WardrobeItem.id == item_uuid, WardrobeItem.user_id == user.id)
            .first()
        )
        if not item or not item.category_ref:
            continue
        try:
            layer = Layer(item.category_ref.name)
        except ValueError:
            layer = Layer.top
        if layer in used_layers:
            continue  # enforce UNIQUE(outfit_id, layer)
        used_layers.add(layer)
        db.add(OutfitItem(outfit_id=outfit.id, item_id=item_uuid, layer=layer))

    db.commit()
    db.refresh(outfit)
    return {"id": str(outfit.id)}


@router.get("")
def list_outfits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    outfits = (
        db.query(Outfit)
        .options(
            joinedload(Outfit.outfit_items).joinedload(OutfitItem.item).options(
                joinedload(WardrobeItem.category_ref),
                joinedload(WardrobeItem.colour_ref),
            )
        )
        .filter(Outfit.user_id == user.id)
        .order_by(Outfit.created_at.desc())
        .all()
    )

    result = []
    for o in outfits:
        result.append({
            "id":               str(o.id),
            "name":             o.name,
            "score":            o.score,
            "weather_temp":     o.weather_temp,
            "is_auto_generated": o.is_auto_generated,
            "used_at":          str(o.used_at) if o.used_at else None,
            "created_at":       str(o.created_at),
            "items": [
                {
                    "id":              str(oi.item.id),
                    "name":            oi.item.name,
                    "image_url":       oi.item.image_url,
                    "image_no_bg_url": oi.item.image_no_bg_url,
                    "category":        oi.item.category_ref.name if oi.item.category_ref else "",
                    "layer":           oi.layer,
                }
                for oi in o.outfit_items if oi.item
            ],
        })
    return result


class OutfitUpdate(BaseModel):
    name:     Optional[str] = None
    item_ids: Optional[str] = None   # comma-separated; replaces all items if provided


@router.patch("/{oid}")
def update_outfit(
    oid: str,
    body: OutfitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        outfit_uuid = _uuid.UUID(oid)
    except ValueError:
        raise HTTPException(400, "Invalid outfit id")

    o = db.query(Outfit).filter(Outfit.id == outfit_uuid, Outfit.user_id == user.id).first()
    if not o:
        raise HTTPException(404, "Not found")

    if body.name is not None:
        o.name = body.name

    if body.item_ids is not None:
        # remove old items
        db.query(OutfitItem).filter(OutfitItem.outfit_id == o.id).delete()
        db.flush()
        used_layers: set = set()
        for id_str in body.item_ids.split(","):
            id_str = id_str.strip()
            if not id_str:
                continue
            try:
                item_uuid = _uuid.UUID(id_str)
            except ValueError:
                continue
            item = (
                db.query(WardrobeItem)
                .options(joinedload(WardrobeItem.category_ref))
                .filter(WardrobeItem.id == item_uuid, WardrobeItem.user_id == user.id)
                .first()
            )
            if not item or not item.category_ref:
                continue
            try:
                layer = Layer(item.category_ref.name)
            except ValueError:
                layer = Layer.top
            if layer in used_layers:
                continue
            used_layers.add(layer)
            db.add(OutfitItem(outfit_id=o.id, item_id=item_uuid, layer=layer))

    o.is_auto_generated = False
    db.commit()
    return {"ok": True}


@router.delete("/{oid}")
def delete_outfit(
    oid: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        outfit_uuid = _uuid.UUID(oid)
    except ValueError:
        raise HTTPException(400, "Invalid outfit id")

    o = db.query(Outfit).filter(Outfit.id == outfit_uuid, Outfit.user_id == user.id).first()
    if not o:
        raise HTTPException(404, "Not found")
    db.delete(o)
    db.commit()
    return {"ok": True}
