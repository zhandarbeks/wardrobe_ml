from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from database import engine, Base
import models

from routers import auth, wardrobe, outfits, weather, profile, admin

Base.metadata.create_all(bind=engine)

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
