"""Synthetic demo account, demo login, and load-demo wardrobe isolation."""

from __future__ import annotations

from fastapi.testclient import TestClient

from vastra.config import clear_settings_cache
from vastra.demo import DEMO_PROFILE, DEMO_WARDROBE_ITEMS, NAME_PREFIX, seed_demo_account
from vastra.db import get_session_factory


DEMO_USERNAME = "demo@vastra.example"
DEMO_PASSWORD = "demo-pass-not-for-production"


def _seed(monkeypatch, username: str = DEMO_USERNAME, password: str = DEMO_PASSWORD) -> None:
    monkeypatch.setenv("DEMO_EMAIL", username)
    monkeypatch.setenv("DEMO_PASSWORD", password)
    clear_settings_cache()
    session = get_session_factory()()
    try:
        seed_demo_account(session, username, password)
        session.commit()
    finally:
        session.close()


def _login(client: TestClient, username: str, password: str = "securepass1") -> dict[str, str]:
    assert client.post("/auth/register", json={"username": username, "password": password}).status_code == 201
    login = client.post("/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_demo_catalog_is_synthetic_and_covers_required_shapes() -> None:
    assert 12 <= len(DEMO_WARDROBE_ITEMS) <= 15
    names = [item["name"] for item in DEMO_WARDROBE_ITEMS]
    assert all(name.startswith(NAME_PREFIX) for name in names)
    assert len(set(names)) == len(names)
    categories = {item["category"] for item in DEMO_WARDROBE_ITEMS}
    assert {"top", "bottom", "one_piece", "shoes", "outerwear", "accessory"} <= categories
    laundry = [item for item in DEMO_WARDROBE_ITEMS if item["availability"] == "in_laundry"]
    available = [item for item in DEMO_WARDROBE_ITEMS if item["availability"] == "available"]
    assert len(laundry) == 2
    assert len(available) >= 10
    notes = " ".join(item["notes"].lower() for item in DEMO_WARDROBE_ITEMS)
    for occasion in ("dinner", "wedding", "interview", "festive"):
        assert occasion in notes
    for style in ("indian", "western", "fusion"):
        assert style in notes
    assert DEMO_PROFILE["styling_preference"] == "unisex"
    assert set(DEMO_PROFILE["preferred_styles"]) == {"Indian", "Western", "fusion"}


def test_auth_demo_unavailable_when_env_missing(client: TestClient) -> None:
    response = client.post("/auth/demo")
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"].lower()
    assert "password" not in response.json()["detail"].lower()


def test_auth_demo_unavailable_when_not_seeded(client: TestClient, monkeypatch) -> None:
    monkeypatch.setenv("DEMO_EMAIL", DEMO_USERNAME)
    monkeypatch.setenv("DEMO_PASSWORD", DEMO_PASSWORD)
    clear_settings_cache()
    response = client.post("/auth/demo")
    assert response.status_code == 503
    assert "seeded" in response.json()["detail"].lower()


def test_auth_demo_signs_in_seeded_user(client: TestClient, monkeypatch) -> None:
    _seed(monkeypatch)
    response = client.post("/auth/demo")
    assert response.status_code == 200
    token = response.json()["access_token"]
    assert token
    assert "password" not in response.json()
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == DEMO_USERNAME


def test_demo_user_cannot_see_or_edit_another_users_records(client: TestClient, monkeypatch) -> None:
    _seed(monkeypatch)
    other_headers = _login(client, "other-owner")
    created = client.post(
        "/wardrobe",
        headers=other_headers,
        json={
            "name": "Private navy kurta",
            "category": "top",
            "color": "Navy",
            "notes": "belongs to another user",
            "availability": "available",
        },
    )
    assert created.status_code == 201
    private_id = created.json()["id"]
    profile = client.put(
        "/profile",
        headers=other_headers,
        json={
            "styling_preference": "men",
            "preferred_styles": ["Western"],
            "preferred_colors": ["olive"],
            "fit_preferences": [],
            "comfort_preferences": [],
            "clothing_to_avoid": [],
        },
    )
    assert profile.status_code == 200

    demo = client.post("/auth/demo")
    demo_headers = {"Authorization": f"Bearer {demo.json()['access_token']}"}
    demo_items = client.get("/wardrobe", headers=demo_headers).json()
    demo_ids = {item["id"] for item in demo_items}
    assert private_id not in demo_ids
    assert all(item["name"].startswith(NAME_PREFIX) for item in demo_items)
    assert client.get(f"/wardrobe/{private_id}", headers=demo_headers).status_code == 404
    assert (
        client.patch(
            f"/wardrobe/{private_id}",
            headers=demo_headers,
            json={"availability": "packed_away"},
        ).status_code
        == 404
    )
    assert client.delete(f"/wardrobe/{private_id}", headers=demo_headers).status_code == 404

    other_list = client.get("/wardrobe", headers=other_headers).json()
    assert [item["id"] for item in other_list] == [private_id]
    first_demo_id = demo_items[0]["id"]
    assert client.get(f"/wardrobe/{first_demo_id}", headers=other_headers).status_code == 404
    assert (
        client.patch(
            f"/wardrobe/{first_demo_id}",
            headers=other_headers,
            json={"name": "Hijacked"},
        ).status_code
        == 404
    )


def test_load_demo_wardrobe_copies_into_empty_owner_only(client: TestClient, monkeypatch) -> None:
    _seed(monkeypatch)
    empty_headers = _login(client, "empty-closet")
    loaded = client.post("/wardrobe/demo", headers=empty_headers)
    assert loaded.status_code == 201
    items = loaded.json()
    assert len(items) == len(DEMO_WARDROBE_ITEMS)
    assert all(item["name"].startswith(NAME_PREFIX) for item in items)
    owner_id = client.get("/auth/me", headers=empty_headers).json()["id"]
    assert {item["owner_id"] for item in items} == {owner_id}

    again = client.post("/wardrobe/demo", headers=empty_headers)
    assert again.status_code == 409

    demo = client.post("/auth/demo")
    demo_headers = {"Authorization": f"Bearer {demo.json()['access_token']}"}
    demo_ids = {item["id"] for item in client.get("/wardrobe", headers=demo_headers).json()}
    copied_ids = {item["id"] for item in items}
    assert demo_ids.isdisjoint(copied_ids)


def test_seed_is_idempotent(client: TestClient, monkeypatch) -> None:
    _seed(monkeypatch)
    first = client.post("/auth/demo")
    first_items = client.get(
        "/wardrobe",
        headers={"Authorization": f"Bearer {first.json()['access_token']}"},
    ).json()
    _seed(monkeypatch)
    second = client.post("/auth/demo")
    second_items = client.get(
        "/wardrobe",
        headers={"Authorization": f"Bearer {second.json()['access_token']}"},
    ).json()
    assert len(second_items) == len(DEMO_WARDROBE_ITEMS)
    assert len(first_items) == len(DEMO_WARDROBE_ITEMS)
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {second.json()['access_token']}"})
    assert me.json()["username"] == DEMO_USERNAME
