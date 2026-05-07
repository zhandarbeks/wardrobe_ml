from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from database import engine, Base
import models  # noqa: F401 — registers all ORM classes before create_all

from routers import auth, wardrobe, outfits, weather, profile, admin
from sqlalchemy import text

Base.metadata.create_all(bind=engine)

# Lightweight idempotent migrations — runs every startup, only does work the
# first time. We do this instead of pulling in Alembic for a small project.
def _run_migrations():
    statements = [
        # Email verification — added in v3.1
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE",
    ]
    with engine.begin() as conn:
        for sql in statements:
            try:
                conn.execute(text(sql))
            except Exception as e:
                print(f"[migrations] '{sql}' skipped: {e}")
_run_migrations()

# Seed lookup tables (categories, colours, materials, styles) on first run
from seed import seed as _seed
_seed()

app = FastAPI(title="WarDrobe AI", version="1.0-MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path("/app/uploads").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(wardrobe.router)
app.include_router(outfits.router)
app.include_router(weather.router)
app.include_router(profile.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "backend"}
