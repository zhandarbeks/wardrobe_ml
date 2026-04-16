from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import httpx
import os
import shutil
import uuid

from database import get_db
from models import User, WardrobeItem, MLLog
from deps import get_current_user

router = APIRouter(prefix="/api/v1/wardrobe", tags=["wardrobe"])

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
ML_URL = os.getenv("ML_SERVICE_URL", "http://ml-service:8001")


def calc_season(tmin: int, tmax: int) -> str:
    mid = (tmin + tmax) / 2
    if mid < 5:
        return "winter"
    if mid < 15:
        return "demi"
    if mid < 25:
        return "summer"
    return "all"


def item_dict(i: WardrobeItem) -> dict:
    return {
        "id": i.id,
        "name": i.name,
        "category": i.category,
        "subcategory": i.subcategory,
        "color": i.color,
        "brand": i.brand,
        "material": i.material,
        "styles": i.styles,
        "temp_min": i.temp_min,
        "temp_max": i.temp_max,
        "season": i.season,
        "image_url": i.image_url,
        "image_no_bg_url": i.image_no_bg_url,
        "ml_confidence": i.ml_confidence,
        "created_at": str(i.created_at),
    }


@router.get("")
def get_wardrobe(
    category: str = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(WardrobeItem).filter(WardrobeItem.user_id == user.id)
    if category:
        q = q.filter(WardrobeItem.category == category)
    return [item_dict(i) for i in q.order_by(WardrobeItem.created_at.desc()).all()]


@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(400, "Unsupported image format")

    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    image_url = f"/uploads/{filename}"

    # Call ML service
    ml: dict = {}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(filepath, "rb") as f:
                resp = await client.post(
                    f"{ML_URL}/analyze",
                    files={"file": (filename, f, "image/jpeg")},
                )
        if resp.status_code == 200:
            ml = resp.json()
    except Exception:
        pass

    no_bg_url = f"/uploads/{ml['no_bg_filename']}" if ml.get("no_bg_filename") else image_url

    db.add(MLLog(
        user_id=user.id,
        predicted_category=ml.get("category"),
        confidence=ml.get("confidence", 0),
    ))
    db.commit()

    # Serialize embedding as JSON string (128 floats → stored in WardrobeItem later)
    import json as _json
    embedding_raw = ml.get("embedding", [])
    embedding_str = _json.dumps(embedding_raw) if embedding_raw else None

    return {
        "image_url": image_url,
        "image_no_bg_url": no_bg_url,
        "category": ml.get("category", "top"),
        "subcategory": ml.get("subcategory", ""),
        "color": ml.get("color", "black"),
        "confidence": ml.get("confidence", 0.0),
        "embedding": embedding_str,
    }


class ItemCreate(BaseModel):
    name: str
    category: str
    subcategory: Optional[str] = None
    color: str
    brand: Optional[str] = None
    material: Optional[str] = None
    styles: Optional[str] = None
    temp_min: int = -30
    temp_max: int = 40
    image_url: Optional[str] = None
    image_no_bg_url: Optional[str] = None
    ml_confidence: Optional[float] = None
    embedding: Optional[str] = None  # JSON-encoded 128-dim float array


@router.post("/items")
def create_item(
    body: ItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = WardrobeItem(
        user_id=user.id,
        name=body.name,
        category=body.category,
        subcategory=body.subcategory,
        color=body.color,
        brand=body.brand,
        material=body.material,
        styles=body.styles,
        temp_min=body.temp_min,
        temp_max=body.temp_max,
        season=calc_season(body.temp_min, body.temp_max),
        image_url=body.image_url,
        image_no_bg_url=body.image_no_bg_url,
        ml_confidence=body.ml_confidence,
        embedding=body.embedding,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item_dict(item)


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    color: Optional[str] = None
    brand: Optional[str] = None
    material: Optional[str] = None
    styles: Optional[str] = None
    temp_min: Optional[int] = None
    temp_max: Optional[int] = None


@router.patch("/items/{item_id}")
def update_item(
    item_id: int,
    body: ItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.query(WardrobeItem).filter(
        WardrobeItem.id == item_id,
        WardrobeItem.user_id == user.id,
    ).first()
    if not item:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    if body.temp_min is not None or body.temp_max is not None:
        item.season = calc_season(item.temp_min, item.temp_max)
    db.commit()
    return item_dict(item)


@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.query(WardrobeItem).filter(
        WardrobeItem.id == item_id,
        WardrobeItem.user_id == user.id,
    ).first()
    if not item:
        raise HTTPException(404, "Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
