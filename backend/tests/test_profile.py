"""Profile/preferences endpoint tests."""


def test_default_preferences(auth_client):
    r = auth_client.get("/api/v1/profile/preferences")
    assert r.status_code == 200
    body = r.json()
    # contract: heat_sensitivity always present, default 'normal'
    assert body.get("heat_sensitivity") in ("cold", "normal", "hot")
    assert "allow_layering" in body


def test_update_preferences_round_trip(auth_client):
    payload = {
        "styles":           "casual,streetwear",
        "favorite_colors":  "black,navy",
        "disliked_colors":  "yellow",
        "heat_sensitivity": "hot",
        "allow_layering":   False,
    }
    r = auth_client.put("/api/v1/profile/preferences", json=payload)
    assert r.status_code == 200

    fresh = auth_client.get("/api/v1/profile/preferences").json()
    assert fresh["heat_sensitivity"] == "hot"
    assert fresh["allow_layering"] is False
    assert "casual" in (fresh.get("styles") or "")
    assert "black" in (fresh.get("favorite_colors") or "")
