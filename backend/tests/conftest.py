"""Pytest fixtures for integration tests.

Test isolation strategy:
- A dedicated `wardrobe_test` database is created (once per session) on the same
  Postgres instance the app uses.
- DATABASE_URL is overridden BEFORE the FastAPI app imports, so the production
  DB is never touched.
- Before each test, all tables are dropped + recreated + seeded — clean slate.
- The FastAPI app's `get_db` dependency is overridden to use the test session.
"""
import os
import uuid
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ─── Point the app at the test DB BEFORE importing it ──────────────────
_ADMIN_URL = os.getenv("TEST_ADMIN_URL", "postgresql://wardrobe:wardrobe123@localhost:5433/wardrobe")
_TEST_DB   = os.getenv("TEST_DB_NAME",  "wardrobe_test")
_TEST_URL  = _ADMIN_URL.rsplit("/", 1)[0] + f"/{_TEST_DB}"
os.environ["DATABASE_URL"] = _TEST_URL
os.environ["EMAIL_BACKEND"] = "console"   # don't try to send real emails
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-32chars")


def _ensure_test_db():
    """Connect to the default 'wardrobe' DB and create 'wardrobe_test' if missing."""
    admin = create_engine(_ADMIN_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"),
            {"n": _TEST_DB},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{_TEST_DB}"'))
    admin.dispose()


_ensure_test_db()

# Now safe to import the app — DATABASE_URL is already pointed at test DB
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, engine, SessionLocal, get_db   # noqa: E402
import models  # noqa: E402  (registers all tables on Base)
from main import app  # noqa: E402
from seed import seed as _seed  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    """One-shot table creation for the whole test session."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _clean_state():
    """Wipe + reseed lookup tables before every test."""
    with engine.begin() as conn:
        # delete user-data tables in FK-safe order; lookup tables get re-seeded
        for tbl in (
            "wardrobe_item_styles", "outfit_items",
            "ml_logs", "outfits", "wardrobe_items",
            "preferences", "email_verification_tokens", "users",
        ):
            conn.execute(text(f'TRUNCATE TABLE "{tbl}" RESTART IDENTITY CASCADE'))
    _seed()
    yield


@pytest.fixture
def client():
    """Plain unauthenticated TestClient."""
    with TestClient(app) as c:
        yield c


def _register_and_login(client, email=None, password="Sup3rSecret!"):
    email = email or f"user-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "email": email, "password": password, "name": "Test User",
    })
    assert r.status_code in (200, 201), r.text
    token = r.json()["access_token"]
    return email, token


@pytest.fixture
def auth_client(client):
    """TestClient with a fresh registered user and Authorization header set."""
    email, token = _register_and_login(client)
    client.headers.update({"Authorization": f"Bearer {token}"})
    client.email = email   # type: ignore[attr-defined]
    return client
