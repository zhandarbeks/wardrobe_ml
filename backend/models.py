from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class HeatSensitivity(str, enum.Enum):
    cold = "cold"
    normal = "normal"
    hot = "hot"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    city = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("WardrobeItem", back_populates="user", cascade="all, delete-orphan")
    outfits = relationship("Outfit", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("Preference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    ml_logs = relationship("MLLog", back_populates="user", cascade="all, delete-orphan")


class WardrobeItem(Base):
    __tablename__ = "wardrobe_items"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    # category: top | mid | outer | bottom | footwear | accessory
    category = Column(String(50), nullable=False, default="top")
    subcategory = Column(String(100), nullable=True)
    color = Column(String(50), nullable=False, default="black")
    brand = Column(String(100), nullable=True)
    material = Column(String(100), nullable=True)
    # comma-separated e.g. "casual,sport"
    styles = Column(String(300), nullable=True)
    temp_min = Column(Integer, default=-30, nullable=False)
    temp_max = Column(Integer, default=40, nullable=False)
    season = Column(String(50), nullable=True)
    image_url = Column(Text, nullable=True)
    image_no_bg_url = Column(Text, nullable=True)
    ml_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="items")


class Outfit(Base):
    __tablename__ = "outfits"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=True)
    # comma-separated item ids
    item_ids = Column(String(500), nullable=False)
    is_auto_generated = Column(Boolean, default=True)
    score = Column(Float, nullable=True)
    weather_temp = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="outfits")


class Preference(Base):
    __tablename__ = "preferences"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    styles = Column(String(300), nullable=True)
    favorite_colors = Column(String(300), nullable=True)
    disliked_colors = Column(String(300), nullable=True)
    heat_sensitivity = Column(SAEnum(HeatSensitivity), default=HeatSensitivity.normal)
    allow_layering = Column(Boolean, default=True)

    user = relationship("User", back_populates="preferences")


class MLLog(Base):
    __tablename__ = "ml_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    predicted_category = Column(String(100), nullable=True)
    confidence = Column(Float, nullable=True)
    manually_corrected = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="ml_logs")
