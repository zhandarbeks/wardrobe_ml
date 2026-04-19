from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from database import get_db
from models import User, WardrobeItem, Outfit, MLLog
from deps import get_admin

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/stats")
def stats(db: Session = Depends(get_db), _: User = Depends(get_admin)):
    return {
        "total_users": db.query(User).count(),
        "new_users_7d": db.query(User).filter(
            User.created_at >= datetime.utcnow() - timedelta(days=7)
        ).count(),
        "total_items": db.query(WardrobeItem).count(),
        "total_outfits_30d": db.query(Outfit).filter(
            Outfit.created_at >= datetime.utcnow() - timedelta(days=30)
        ).count(),
        "avg_ml_confidence": round(
            float(db.query(func.avg(MLLog.confidence)).scalar() or 0), 2
        ),
        "total_ml_logs": db.query(MLLog).count(),
    }


@router.get("/users")
def users(db: Session = Depends(get_db), _: User = Depends(get_admin)):
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": str(u.created_at),
            "item_count": db.query(WardrobeItem).filter(WardrobeItem.user_id == u.id).count(),
        }
        for u in db.query(User).order_by(User.created_at.desc()).all()
    ]


@router.patch("/users/{uid}")
def update_user(
    uid: str,
    data: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin),
):
    import uuid as _uuid
    try:
        user_uuid = _uuid.UUID(uid)
    except ValueError:
        raise HTTPException(400, "Invalid user id")
    u = db.query(User).filter(User.id == user_uuid).first()
    if not u:
        raise HTTPException(404, "Not found")
    if "is_active" in data:
        u.is_active = data["is_active"]
    if "role" in data:
        u.role = data["role"]
    db.commit()
    return {"ok": True}


@router.delete("/users/{uid}")
def delete_user(uid: str, db: Session = Depends(get_db), _: User = Depends(get_admin)):
    import uuid as _uuid
    try:
        user_uuid = _uuid.UUID(uid)
    except ValueError:
        raise HTTPException(400, "Invalid user id")
    u = db.query(User).filter(User.id == user_uuid).first()
    if not u:
        raise HTTPException(404, "Not found")
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.get("/ml/logs")
def ml_logs(db: Session = Depends(get_db), _: User = Depends(get_admin)):
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "category": l.predicted_category,
            "confidence": l.confidence,
            "corrected": l.manually_corrected,
            "created_at": str(l.created_at),
        }
        for l in db.query(MLLog).order_by(MLLog.created_at.desc()).limit(100).all()
    ]
