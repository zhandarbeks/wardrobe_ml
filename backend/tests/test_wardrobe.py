"""Wardrobe CRUD tests — list / create / update / delete / stats."""


def _create_item(client, **overrides):
    payload = {
        "name": "Black t-shirt", "category": "top", "subcategory": "t-shirt",
        "color": "black", "temp_min": 15, "temp_max": 35,
    }
    payload.update(overrides)
    return client.post("/api/v1/wardrobe/items", json=payload)


def test_empty_wardrobe(auth_client):
    r = auth_client.get("/api/v1/wardrobe")
    assert r.status_code == 200
    assert r.json() == []


def test_create_then_list_returns_item(auth_client):
    r = _create_item(auth_client)
    assert r.status_code in (200, 201), r.text
    item_id = r.json()["id"]

    listing = auth_client.get("/api/v1/wardrobe").json()
    assert len(listing) == 1
    assert listing[0]["id"] == item_id
    assert listing[0]["name"] == "Black t-shirt"
    assert listing[0]["color"] == "black"
    assert listing[0]["temp_min"] == 15
    assert listing[0]["temp_max"] == 35


def test_update_item(auth_client):
    item_id = _create_item(auth_client).json()["id"]
    r = auth_client.patch(f"/api/v1/wardrobe/items/{item_id}", json={
        "name": "Renamed", "color": "white",
    })
    assert r.status_code == 200
    listing = auth_client.get("/api/v1/wardrobe").json()
    assert listing[0]["name"] == "Renamed"
    assert listing[0]["color"] == "white"


def test_delete_item(auth_client):
    item_id = _create_item(auth_client).json()["id"]
    r = auth_client.delete(f"/api/v1/wardrobe/items/{item_id}")
    assert r.status_code == 200
    assert auth_client.get("/api/v1/wardrobe").json() == []


def test_stats_reflects_items(auth_client):
    _create_item(auth_client, name="Tshirt 1")
    _create_item(auth_client, name="Jeans",   category="bottom", subcategory="jeans",
                              color="navy", temp_min=-5, temp_max=25)
    r = auth_client.get("/api/v1/wardrobe/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    assert body["by_category"].get("top") == 1
    assert body["by_category"].get("bottom") == 1
