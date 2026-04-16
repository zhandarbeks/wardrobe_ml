import uuid as _uuid
import os
import shutil

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import httpx

from database import get_db
from models import User, WardrobeItem, MLLog, Category, Colour, Material, Style
from deps import get_current_user

router = APIRouter(prefix="/api/v1/wardrobe", tags=["wardrobe"])

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
ML_URL = os.getenv("ML_SERVICE_URL", "http://ml-service:8001")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create(db: Session, model, name: str):
    """Find a lookup row by name, create it if absent."""
    name = name.strip().lower()
    obj = db.query(model).filter_by(name=name).first()
    if not obj:
        obj = model(name=name)
        db.add(obj)
        db.flush()
    return obj


def calc_season(tmin: int, tmax: int) -> str:
    mid = (tmin + tmax) / 2
    if mid < 5:  return "winter"
    if mid < 15: return "demi"
    if mid < 25: return "summer"
    return "all"


def item_dict(i: WardrobeItem) -> dict:
    return {
        "id":              str(i.id),
        "name":            i.name,
        "category":        i.category_ref.name if i.category_ref else "",
        "subcategory":     i.subcategory or "",
        "color":           i.colour_ref.name   if i.colour_ref   else "",
        "material":        i.material_ref.name if i.material_ref else None,
        "brand":           i.brand,
        "styles":          ",".join(s.name for s in i.styles),
        "temp_min":        i.temp_min,
        "temp_max":        i.temp_max,
        "season":          i.season,
        "image_url":       i.image_url,
        "image_no_bg_url": i.image_no_bg_url,
        "ml_confidence":   i.ml_confidence,
        "last_worn_at":    str(i.last_worn_at) if i.last_worn_at else None,
        "created_at":      str(i.created_at),
    }


def _load_items(db: Session, user_id, category: str = None):
    q = (
        db.query(WardrobeItem)
        .options(
            joinedload(WardrobeItem.category_ref),
            joinedload(WardrobeItem.colour_ref),
            joinedload(WardrobeItem.material_ref),
            joinedload(WardrobeItem.styles),
        )
        .filter(WardrobeItem.user_id == user_id)
    )
    if category:
        q = q.join(WardrobeItem.category_ref).filter(Category.name == category)
    return q.order_by(WardrobeItem.created_at.desc()).all()


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def get_wardrobe(
    category: str = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return [item_dict(i) for i in _load_items(db, user.id, category)]


@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(400, "Unsupported image format")

    filename  = f"{_uuid.uuid4()}.{ext}"
    filepath  = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    image_url = f"/uploads/{filename}"

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

    import json as _json
    embedding_raw = ml.get("embedding", [])
    embedding_str = _json.dumps(embedding_raw) if embedding_raw else None

    db.add(MLLog(
        user_id=user.id,
        input_image_url=image_url,
        predicted_category=ml.get("category"),
        confidence=ml.get("confidence", 0),
    ))
    db.commit()

    return {
        "image_url":       image_url,
        "image_no_bg_url": no_bg_url,
        "category":        ml.get("category",    "top"),
        "subcategory":     ml.get("subcategory", ""),
        "color":           ml.get("color",       "black"),
        "confidence":      ml.get("confidence",  0.0),
        "embedding":       embedding_str,
    }


class ItemCreate(BaseModel):
    name:           str
    category:       str
    subcategory:    Optional[str]   = None
    color:          str
    material:       Optional[str]   = None
    brand:          Optional[str]   = None
    styles:         Optional[str]   = None   # comma-separated
    temp_min:       int             = -30
    temp_max:       int             = 40
    image_url:      Optional[str]   = None
    image_no_bg_url: Optional[str]  = None
    ml_confidence:  Optional[float] = None
    embedding:      Optional[str]   = None


@router.post("/items")
def create_item(
    body: ItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat  = _get_or_create(db, Category, body.category)
    col  = _get_or_create(db, Colour,   body.color)
    mat  = _get_or_create(db, Material, body.material) if body.material else None

    item = WardrobeItem(
        user_id         = user.id,
        name            = body.name,
        category_id     = cat.id,
        color_id        = col.id,
        material_id     = mat.id if mat else None,
        brand           = body.brand,
        subcategory     = body.subcategory,
        temp_min        = body.temp_min,
        temp_max        = body.temp_max,
        season          = calc_season(body.temp_min, body.temp_max),
        image_url       = body.image_url,
        image_no_bg_url = body.image_no_bg_url,
        ml_confidence   = body.ml_confidence,
        embedding       = body.embedding,
    )
    db.add(item)
    db.flush()

    if body.styles:
        for s_name in body.styles.split(","):
            s_name = s_name.strip()
            if s_name:
                style = _get_or_create(db, Style, s_name)
                item.styles.append(style)

    db.commit()
    db.refresh(item)
    return item_dict(item)


class ItemUpdate(BaseModel):
    name:        Optional[str] = None
    category:    Optional[str] = None
    subcategory: Optional[str] = None
    color:       Optional[str] = None
    material:    Optional[str] = None
    brand:       Optional[str] = None
    styles:      Optional[str] = None
    temp_min:    Optional[int] = None
    temp_max:    Optional[int] = None


@router.patch("/items/{item_id}")
def update_item(
    item_id: str,
    body: ItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        item_uuid = _uuid.UUID(item_id)
    except ValueError:
        raise HTTPException(400, "Invalid item id")

    item = db.query(WardrobeItem).filter(
        WardrobeItem.id == item_uuid,
        WardrobeItem.user_id == user.id,
    ).first()
    if not item:
        raise HTTPException(404, "Not found")

    if body.name        is not None: item.name        = body.name
    if body.subcategory is not None: item.subcategory = body.subcategory
    if body.brand       is not None: item.brand       = body.brand
    if body.temp_min    is not None: item.temp_min    = body.temp_min
    if body.temp_max    is not None: item.temp_max    = body.temp_max

    if body.category is not None:
        item.category_id = _get_or_create(db, Category, body.category).id
    if body.color is not None:
        item.color_id = _get_or_create(db, Colour, body.color).id
    if body.material is not None:
        item.material_id = _get_or_create(db, Material, body.material).id

    if body.styles is not None:
        item.styles.clear()
        for s_name in body.styles.split(","):
            s_name = s_name.strip()
            if s_name:
                item.styles.append(_get_or_create(db, Style, s_name))

    if body.temp_min is not None or body.temp_max is not None:
        item.season = calc_season(item.temp_min, item.temp_max)

    db.commit()
    db.refresh(item)
    return item_dict(item)


@router.delete("/items/{item_id}")
def delete_item(
    item_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        item_uuid = _uuid.UUID(item_id)
    except ValueError:
        raise HTTPException(400, "Invalid item id")

    item = db.query(WardrobeItem).filter(
        WardrobeItem.id == item_uuid,
        WardrobeItem.user_id == user.id,
    ).first()
    if not item:
        raise HTTPException(404, "Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
