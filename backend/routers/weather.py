import time
import os
import httpx
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import User
from deps import get_current_user

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])

KEY = os.getenv("OPENWEATHER_API_KEY", "")
# Simple in-process cache: {user_id: (timestamp, data)}
_cache: dict = {}
TTL = 1800  # 30 minutes


async def _fetch_weather(lat: float, lon: float) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"lat": lat, "lon": lon, "appid": KEY, "units": "metric"},
        )
    d = r.json()
    return {
        "temp": d["main"]["temp"],
        "feels_like": d["main"]["feels_like"],
        "wind_speed": d["wind"]["speed"],
        "pop": 0,
        "description": d["weather"][0]["description"],
        "icon": d["weather"][0]["icon"],
        "city": d["name"],
    }


@router.get("/current")
async def current(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = user.id
    if uid in _cache and time.time() - _cache[uid][0] < TTL:
        return _cache[uid][1]

    if not user.latitude and not user.city:
        return {
            "temp": 15, "feels_like": 15, "wind_speed": 0, "pop": 0,
            "description": "Set your city in profile", "city": "—",
        }

    try:
        lat, lon = user.latitude, user.longitude
        if not lat:
            async with httpx.AsyncClient(timeout=8.0) as c:
                geo = (await c.get(
                    "http://api.openweathermap.org/geo/1.0/direct",
                    params={"q": user.city, "limit": 1, "appid": KEY},
                )).json()
            if not geo:
                raise ValueError("City not found")
            lat, lon = geo[0]["lat"], geo[0]["lon"]
            db.query(User).filter(User.id == uid).update({"latitude": lat, "longitude": lon})
            db.commit()
        result = await _fetch_weather(lat, lon)
        # prefer the user-saved name (from Profile or suggestion pick) over OpenWeather's bare city
        if user.city:
            result["city"] = user.city
    except Exception:
        result = {
            "temp": 15, "feels_like": 15, "wind_speed": 0, "pop": 0,
            "description": "Weather unavailable", "city": user.city or "—",
        }

    _cache[uid] = (time.time(), result)
    return result


class CityBody(BaseModel):
    city: str


class LocationBody(BaseModel):
    lat:  float
    lon:  float
    city: Optional[str] = None  # optional resolved name (from suggestion or reverse-geocode)


def _invalidate_caches(uid):
    _cache.pop(uid, None)
    try:
        from routers.outfits import _wcache
        _wcache.pop(uid, None)
    except Exception:
        pass


@router.post("/city")
async def set_city(
    body: CityBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # User typed a city by hand → coords from previous location are stale, clear them.
    db.query(User).filter(User.id == user.id).update({
        "city": body.city,
        "latitude": None,
        "longitude": None,
    })
    db.commit()
    _invalidate_caches(user.id)
    return {"ok": True}


@router.post("/location")
async def set_location(
    body: LocationBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save coordinates from browser Geolocation API or a picked suggestion.
    If `city` is supplied (e.g. resolved from suggestion / reverse-geocode), persist it.
    Otherwise leave the existing city untouched so it stays in sync with Profile.
    """
    update = {"latitude": body.lat, "longitude": body.lon}
    if body.city is not None:
        update["city"] = body.city.strip() or None
    db.query(User).filter(User.id == user.id).update(update)
    db.commit()
    _invalidate_caches(user.id)
    return {"ok": True}


@router.get("/reverse")
async def reverse_geocode(lat: float, lon: float):
    """Reverse-geocode coordinates → city/state/country via OpenWeather."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            geo = (await c.get(
                "http://api.openweathermap.org/geo/1.0/reverse",
                params={"lat": lat, "lon": lon, "limit": 1, "appid": KEY},
            )).json()
        if not isinstance(geo, list) or not geo:
            return None
        g = geo[0]
        return {
            "name":    g["name"],
            "country": g.get("country", ""),
            "state":   g.get("state", ""),
            "lat":     g["lat"],
            "lon":     g["lon"],
        }
    except Exception:
        return None


@router.get("/search")
async def search_cities(q: str = ""):
    """Proxy to OpenWeather Geocoding — returns up to 5 city suggestions."""
    if not q or len(q.strip()) < 2:
        return []
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            geo = (await c.get(
                "http://api.openweathermap.org/geo/1.0/direct",
                params={"q": q.strip(), "limit": 5, "appid": KEY},
            )).json()
        if not isinstance(geo, list):
            return []
        return [
            {
                "name": g["name"],
                "country": g.get("country", ""),
                "state": g.get("state", ""),
                "lat": g["lat"],
                "lon": g["lon"],
            }
            for g in geo
        ]
    except Exception:
        return []
