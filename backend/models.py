import uuid
import enum
from sqlalchemy import (
    Column, String, Boolean, Float, DateTime, ForeignKey,
    Text, SmallInteger, Integer, UniqueConstraint, Index,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class HeatSensitivity(str, enum.Enum):
    cold = "cold"
    normal = "normal"
    hot = "hot"


class Layer(str, enum.Enum):
    top = "top"
    mid = "mid"
    outer = "outer"
    bottom = "bottom"
    footwear = "footwear"
    accessory = "accessory"


class Occasion(str, enum.Enum):
    casual    = "casual"
    formal    = "formal"
    sport     = "sport"
    outdoor   = "outdoor"
    any       = "any"


# ── Lookup / Reference tables ────────────────────────────────────────────────

class Category(Base):
    __tablename__ = "categories"
    id   = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)

    items = relationship("WardrobeItem", back_populates="category_ref")


class Colour(Base):
    __tablename__ = "colours"
    id   = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)

    items = relationship("WardrobeItem", back_populates="colour_ref")


class Material(Base):
    __tablename__ = "materials"
    id   = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)

    items = relationship("WardrobeItem", back_populates="material_ref")


class Style(Base):
    __tablename__ = "styles"
    id   = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)


# ── Junction tables ──────────────────────────────────────────────────────────

class WardrobeItemStyle(Base):
    __tablename__ = "wardrobe_item_styles"
    wardrobe_item_id = Column(
        UUID(as_uuid=True), ForeignKey("wardrobe_items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    style_id = Column(
        Integer, ForeignKey("styles.id", ondelete="CASCADE"),
        primary_key=True,
    )


class OutfitItem(Base):
    __tablename__ = "outfit_items"
    outfit_id = Column(
        UUID(as_uuid=True), ForeignKey("outfits.id", ondelete="CASCADE"),
        primary_key=True,
    )
    item_id = Column(
        UUID(as_uuid=True), ForeignKey("wardrobe_items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    layer = Column(SAEnum(Layer), nullable=False)

    outfit = relationship("Outfit", back_populates="outfit_items")
    item   = relationship("WardrobeItem", back_populates="outfit_entries")

    __table_args__ = (
        UniqueConstraint("outfit_id", "layer", name="uq_outfit_layer"),
    )


class PreferenceStyle(Base):
    __tablename__ = "preference_styles"
    user_id  = Column(UUID(as_uuid=True), ForeignKey("preferences.user_id", ondelete="CASCADE"), primary_key=True)
    style_id = Column(Integer, ForeignKey("styles.id", ondelete="CASCADE"), primary_key=True)


class PreferenceFavouriteColour(Base):
    __tablename__ = "preference_favourite_colours"
    user_id  = Column(UUID(as_uuid=True), ForeignKey("preferences.user_id", ondelete="CASCADE"), primary_key=True)
    color_id = Column(Integer, ForeignKey("colours.id", ondelete="CASCADE"), primary_key=True)


class PreferenceDislikedColour(Base):
    __tablename__ = "preference_disliked_colours"
    user_id  = Column(UUID(as_uuid=True), ForeignKey("preferences.user_id", ondelete="CASCADE"), primary_key=True)
    color_id = Column(Integer, ForeignKey("colours.id", ondelete="CASCADE"), primary_key=True)


# ── Core tables ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name          = Column(String(100), nullable=False)
    role          = Column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    is_active     = Column(Boolean, default=True, nullable=False)
    city          = Column(String(100), nullable=True)
    latitude      = Column(Float, nullable=True)
    longitude     = Column(Float, nullable=True)
    avatar_url    = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    items       = relationship("WardrobeItem", back_populates="user", cascade="all, delete-orphan")
    outfits     = relationship("Outfit",       back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("Preference",   back_populates="user", uselist=False, cascade="all, delete-orphan")
    ml_logs     = relationship("MLLog",        back_populates="user", cascade="all, delete-orphan")


class WardrobeItem(Base):
    __tablename__ = "wardrobe_items"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name          = Column(String(200), nullable=False)
    category_id   = Column(Integer, ForeignKey("categories.id"), nullable=False)
    color_id      = Column(Integer, ForeignKey("colours.id"),    nullable=False)
    material_id   = Column(Integer, ForeignKey("materials.id"),  nullable=True)
    brand         = Column(String(100), nullable=True)
    # subcategory kept as plain string for app logic (e.g. "shorts", "sandal")
    subcategory   = Column(String(100), nullable=True)
    temp_min      = Column(SmallInteger, default=-30, nullable=False)
    temp_max      = Column(SmallInteger, default=40,  nullable=False)
    season        = Column(String(50), nullable=True)   # denormalized convenience
    image_url     = Column(Text, nullable=True)
    image_no_bg_url = Column(Text, nullable=True)
    ml_confidence = Column(Float, nullable=True)
    embedding     = Column(Text, nullable=True)         # JSON 128-dim for ModelB
    last_worn_at  = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    user         = relationship("User",     back_populates="items")
    category_ref = relationship("Category", back_populates="items")
    colour_ref   = relationship("Colour",   back_populates="items")
    material_ref = relationship("Material", back_populates="items")
    styles       = relationship("Style",    secondary="wardrobe_item_styles")
    outfit_entries = relationship("OutfitItem", back_populates="item")

    __table_args__ = (
        Index("ix_wardrobe_items_user_id", "user_id"),
    )


class Outfit(Base):
    __tablename__ = "outfits"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id           = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name              = Column(String(200), nullable=True)
    is_auto_generated = Column(Boolean, default=True, nullable=False)
    occasion          = Column(SAEnum(Occasion), default=Occasion.any, nullable=False)
    score             = Column(Float, nullable=True)
    weather_temp      = Column(Float, nullable=True)
    used_at           = Column(DateTime(timezone=True), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    user         = relationship("User", back_populates="outfits")
    outfit_items = relationship("OutfitItem", back_populates="outfit", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_outfits_user_id", "user_id"),
    )


class Preference(Base):
    __tablename__ = "preferences"
    user_id           = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    heat_sensitivity  = Column(SAEnum(HeatSensitivity), default=HeatSensitivity.normal, nullable=False)
    allow_layering    = Column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="preferences")
    styles             = relationship("Style",  secondary="preference_styles",             overlaps="items")
    favourite_colours  = relationship("Colour", secondary="preference_favourite_colours",  overlaps="items,colour_ref")
    disliked_colours   = relationship("Colour", secondary="preference_disliked_colours",   overlaps="items,colour_ref,favourite_colours")


class MLLog(Base):
    __tablename__ = "ml_logs"
    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id            = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    input_image_url    = Column(Text, nullable=True)          # original uploaded image
    predicted_category = Column(String(100), nullable=True)
    corrected_category = Column(String(100), nullable=True)   # set when user manually corrects
    confidence         = Column(Float, nullable=True)
    manually_corrected = Column(Boolean, default=False)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="ml_logs")
