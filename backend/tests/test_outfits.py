"""Outfit recommendation + manual outfit CRUD tests."""


def _add_minimal_wardrobe(client):
    """Add a top + bottom + footwear so recommend() has something to combine."""
    items = [
        {"name": "Black T-shirt", "category": "top",      "subcategory": "t-shirt",
         "color": "black", "temp_min": 15, "temp_max": 35, "styles": "casual"},
        {"name": "Blue Jeans",    "category": "bottom",   "subcategory": "jeans",
         "color": "navy",  "temp_min": -5, "temp_max": 25, "styles": "casual"},
        {"name": "Casual Shoes",  "category": "footwear", "subcategory": "casual shoes",
         "color": "white", "temp_min":  0, "temp_max": 30, "styles": "casual"},
    ]
    return [client.post("/api/v1/wardrobe/items", json=i).json() for i in items]


def test_recommend_empty_wardrobe_returns_no_outfits(auth_client):
    r = auth_client.get("/api/v1/outfits/recommend")
    assert r.status_code == 200
    body = r.json()
    assert body.get("outfits", []) == []


def test_recommend_with_minimal_wardrobe(auth_client):
    _add_minimal_wardrobe(auth_client)
    r = auth_client.get("/api/v1/outfits/recommend")
    assert r.status_code == 200
    outfits = r.json()["outfits"]
    assert len(outfits) >= 1
    o = outfits[0]
    # contract: each outfit has items + score + breakdown
    assert isinstance(o["items"], list) and len(o["items"]) >= 2
    assert 0.0 <= o["score"] <= 1.0
    bd = o["score_breakdown"]
    for k in ("color_harmony", "style_match", "weather_fit"):
        assert k in bd and 0.0 <= bd[k] <= 1.0


def test_save_and_list_manual_outfit(auth_client):
    items = _add_minimal_wardrobe(auth_client)
    ids = ",".join(i["id"] for i in items[:2])
    r = auth_client.post("/api/v1/outfits", json={
        "name": "Friday look", "item_ids": ids, "is_auto_generated": False,
    })
    assert r.status_code in (200, 201), r.text
    new_id = r.json()["id"]

    listing = auth_client.get("/api/v1/outfits").json()
    saved = next((o for o in listing if o["id"] == new_id), None)
    assert saved is not None, "outfit not returned from list"
    assert saved["name"] == "Friday look"
    assert len(saved["items"]) == 2


def test_mark_outfit_worn(auth_client):
    items = _add_minimal_wardrobe(auth_client)
    saved = auth_client.post("/api/v1/outfits", json={
        "name": "Today's look",
        "item_ids": ",".join(i["id"] for i in items),
        "is_auto_generated": False,
    }).json()
    r = auth_client.post(f"/api/v1/outfits/{saved['id']}/worn")
    assert r.status_code == 200
    fresh = auth_client.get("/api/v1/outfits").json()
    target = next(o for o in fresh if o["id"] == saved["id"])
    assert target["used_at"] is not None


def test_delete_outfit_cascades_safely(auth_client):
    items = _add_minimal_wardrobe(auth_client)
    saved = auth_client.post("/api/v1/outfits", json={
        "name": "Throwaway",
        "item_ids": ",".join(i["id"] for i in items),
        "is_auto_generated": False,
    }).json()
    r = auth_client.delete(f"/api/v1/outfits/{saved['id']}")
    assert r.status_code == 200
    # wardrobe items must survive outfit deletion
    assert len(auth_client.get("/api/v1/wardrobe").json()) == 3


def test_delete_wardrobe_item_used_in_outfit(auth_client):
    """Regression: SQLAlchemy used to crash on this because outfit_items.item_id
    is NOT NULL and the relationship lacked passive_deletes=True."""
    items = _add_minimal_wardrobe(auth_client)
    auth_client.post("/api/v1/outfits", json={
        "name": "Will-orphan",
        "item_ids": ",".join(i["id"] for i in items),
        "is_auto_generated": False,
    })
    target_id = items[0]["id"]
    r = auth_client.delete(f"/api/v1/wardrobe/items/{target_id}")
    assert r.status_code == 200, r.text
    listing = auth_client.get("/api/v1/wardrobe").json()
    assert all(i["id"] != target_id for i in listing)
