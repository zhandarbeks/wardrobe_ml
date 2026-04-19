"""Populate lookup tables on first startup (idempotent)."""
from database import SessionLocal
from models import Category, Colour, Material, Style

CATEGORIES = ["top", "mid", "outer", "bottom", "footwear", "accessory"]

COLOURS = [
    "black", "white", "gray", "navy", "royal blue", "sky blue",
    "teal", "green", "olive", "yellow", "orange", "red",
    "burgundy", "pink", "purple", "beige", "brown", "camel",
]

MATERIALS = [
    "cotton", "wool", "polyester", "denim", "leather",
    "silk", "linen", "synthetic", "fleece", "down", "knit",
]

STYLES = ["casual", "smart casual", "business", "sport", "streetwear", "formal"]


def seed():
    db = SessionLocal()
    try:
        for name in CATEGORIES:
            if not db.query(Category).filter_by(name=name).first():
                db.add(Category(name=name))
        for name in COLOURS:
            if not db.query(Colour).filter_by(name=name).first():
                db.add(Colour(name=name))
        for name in MATERIALS:
            if not db.query(Material).filter_by(name=name).first():
                db.add(Material(name=name))
        for name in STYLES:
            if not db.query(Style).filter_by(name=name).first():
                db.add(Style(name=name))
        db.commit()
    finally:
        db.close()
