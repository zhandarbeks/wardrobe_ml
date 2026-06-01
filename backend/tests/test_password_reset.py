import uuid


def _register(client, email=None, password="OldPass123!"):
    email = email or f"u-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/v1/auth/register", json={"email": email, "password": password, "name": "Reset User"})
    assert r.status_code in (200, 201)
    return email


def test_forgot_password_returns_dev_link(client):
    email = _register(client)
    r = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert r.status_code == 200
    body = r.json()
    assert body["sent"] is True
    assert "dev_reset_link" in body
    assert "token=" in body["dev_reset_link"]


def test_forgot_password_unknown_email_returns_200(client):
    r = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 200
    assert r.json()["sent"] is True
    assert "dev_reset_link" not in r.json()


def test_reset_password_with_valid_token_succeeds_and_old_password_fails(client):
    email = _register(client, password="OldPass123!")
    link = client.post("/api/v1/auth/forgot-password", json={"email": email}).json()["dev_reset_link"]
    token = link.split("token=")[-1]

    r = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "NewPass456!"})
    assert r.status_code == 200, r.text
    assert r.json()["reset"] is True

    r_old = client.post("/api/v1/auth/login", json={"email": email, "password": "OldPass123!"})
    assert r_old.status_code == 401

    r_new = client.post("/api/v1/auth/login", json={"email": email, "password": "NewPass456!"})
    assert r_new.status_code == 200
    assert "access_token" in r_new.json()


def test_reset_password_token_is_single_use(client):
    email = _register(client)
    token = client.post("/api/v1/auth/forgot-password", json={"email": email}).json()["dev_reset_link"].split("token=")[-1]
    r1 = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "First123!"})
    assert r1.status_code == 200
    r2 = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "Second456!"})
    assert r2.status_code == 400
    assert "used" in r2.json()["detail"].lower()


def test_reset_password_rejects_short_password(client):
    email = _register(client)
    token = client.post("/api/v1/auth/forgot-password", json={"email": email}).json()["dev_reset_link"].split("token=")[-1]
    r = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "abc"})
    assert r.status_code == 400
    assert "6 characters" in r.json()["detail"]


def test_reset_password_unknown_token_rejected(client):
    r = client.post("/api/v1/auth/reset-password", json={"token": "bogus-not-a-real-token", "new_password": "ValidPass1!"})
    assert r.status_code == 400
    assert "unknown" in r.json()["detail"].lower()
