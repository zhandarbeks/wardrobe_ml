"""Auth endpoint tests — register / login / me / duplicate-email / wrong-password."""
import uuid


def _new_email():
    return f"u-{uuid.uuid4().hex[:8]}@example.com"


def test_register_returns_token_and_user(client):
    r = client.post("/api/v1/auth/register", json={
        "email": _new_email(), "password": "Sup3rSecret!", "name": "Alice",
    })
    assert r.status_code in (200, 201)
    body = r.json()
    assert "access_token" in body
    assert body.get("token_type", "bearer").lower() == "bearer"


def test_register_duplicate_email_rejected(client):
    email = _new_email()
    r1 = client.post("/api/v1/auth/register", json={
        "email": email, "password": "Sup3rSecret!", "name": "First",
    })
    assert r1.status_code in (200, 201)
    r2 = client.post("/api/v1/auth/register", json={
        "email": email, "password": "Sup3rSecret!", "name": "Second",
    })
    assert r2.status_code == 400, "duplicate email should be rejected"


def test_login_with_correct_credentials(client):
    email = _new_email()
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Sup3rSecret!", "name": "Bob",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": email, "password": "Sup3rSecret!",
    })
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password_rejected(client):
    email = _new_email()
    client.post("/api/v1/auth/register", json={
        "email": email, "password": "Sup3rSecret!", "name": "Carol",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": email, "password": "WrongPassword!",
    })
    assert r.status_code == 401


def test_me_returns_current_user(auth_client):
    r = auth_client.get("/api/v1/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == auth_client.email   # type: ignore[attr-defined]
    assert "email_verified" in body
    assert body["email_verified"] is False  # fresh registration


def test_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code in (401, 403)
