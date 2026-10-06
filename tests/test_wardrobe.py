"""Authenticated wardrobe API tests (temporary SQLite database)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from vastra.db import get_session_factory
from vastra.models import WardrobeItem

ITEM_A = {
    "name": "Navy kurta",
    "category": "top",
    "color": "navy",
    "notes": "cotton",
    "availability": "available",
}

ITEM_B = {
    "name": "Black loafers",
    "category": "shoes",
    "color": "black",
    "notes": "",
    "availability": "available",
}


def _register_and_login(client: TestClient, username: str) -> tuple[str, dict[str, str]]:
    registered = client.post(
        "/auth/register",
        json={"username": username, "password": "securepass1"},
    )
    assert registered.status_code == 201
    user_id = registered.json()["id"]
    login = client.post(
        "/auth/login",
        json={"username": username, "password": "securepass1"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return user_id, {"Authorization": f"Bearer {token}"}


def test_create_list_patch_and_delete_wardrobe_item(client: TestClient) -> None:
    user_id, headers = _register_and_login(client, "wardowner")

    assert client.get("/wardrobe", headers=headers).json() == []

    created = client.post("/wardrobe", headers=headers, json=ITEM_A)
    assert created.status_code == 201
    body = created.json()
    assert body["owner_id"] == user_id
    assert body["name"] == "Navy kurta"
    assert body["availability"] == "available"
    item_id = body["id"]

    listed = client.get("/wardrobe", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == item_id

    fetched = client.get(f"/wardrobe/{item_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["color"] == "navy"

    patched = client.patch(
        f"/wardrobe/{item_id}",
        headers=headers,
        json={"availability": "in_laundry", "notes": "needs ironing"},
    )
    assert patched.status_code == 200
    assert patched.json()["availability"] == "in_laundry"
    assert patched.json()["notes"] == "needs ironing"
    assert patched.json()["name"] == "Navy kurta"

    deleted = client.delete(f"/wardrobe/{item_id}", headers=headers)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get("/wardrobe", headers=headers).json() == []
    assert client.get(f"/wardrobe/{item_id}", headers=headers).status_code == 404


def test_two_users_have_independent_wardrobes(client: TestClient) -> None:
    user_a, headers_a = _register_and_login(client, "warda")
    user_b, headers_b = _register_and_login(client, "wardb")

    item_a = client.post("/wardrobe", headers=headers_a, json=ITEM_A).json()
    item_b = client.post("/wardrobe", headers=headers_b, json=ITEM_B).json()

    list_a = client.get("/wardrobe", headers=headers_a).json()
    list_b = client.get("/wardrobe", headers=headers_b).json()
    assert len(list_a) == 1
    assert len(list_b) == 1
    assert list_a[0]["owner_id"] == user_a
    assert list_b[0]["owner_id"] == user_b
    assert list_a[0]["id"] == item_a["id"]
    assert list_b[0]["id"] == item_b["id"]

    assert client.get(f"/wardrobe/{item_a['id']}", headers=headers_b).status_code == 404
    assert (
        client.patch(
            f"/wardrobe/{item_a['id']}",
            headers=headers_b,
            json={"availability": "packed_away"},
        ).status_code
        == 404
    )
    assert client.delete(f"/wardrobe/{item_a['id']}", headers=headers_b).status_code == 404


def test_unauthenticated_wardrobe_access_rejected(client: TestClient) -> None:
    assert client.get("/wardrobe").status_code == 401
    assert client.post("/wardrobe", json=ITEM_A).status_code == 401
    assert client.get("/wardrobe/fake-id").status_code == 401
    assert client.patch("/wardrobe/fake-id", json={"availability": "available"}).status_code == 401
    assert client.delete("/wardrobe/fake-id").status_code == 401


def test_invalid_availability_and_blank_fields_rejected(client: TestClient) -> None:
    _, headers = _register_and_login(client, "wardvalid")

    bad_status = client.post(
        "/wardrobe",
        headers=headers,
        json={**ITEM_A, "availability": "missing"},
    )
    assert bad_status.status_code == 422

    blank_name = client.post(
        "/wardrobe",
        headers=headers,
        json={**ITEM_A, "name": "  "},
    )
    assert blank_name.status_code == 422


def test_client_supplied_owner_id_rejected(client: TestClient) -> None:
    user_id, headers = _register_and_login(client, "wardspoof")
    response = client.post(
        "/wardrobe",
        headers=headers,
        json={**ITEM_A, "owner_id": "someone-else"},
    )
    assert response.status_code == 422
    assert any(
        isinstance(err, dict) and "owner_id" in err.get("loc", [])
        for err in response.json()["detail"]
    )

    created = client.post("/wardrobe", headers=headers, json=ITEM_A)
    assert created.status_code == 201
    assert created.json()["owner_id"] == user_id

    patch = client.patch(
        f"/wardrobe/{created.json()['id']}",
        headers=headers,
        json={"owner_id": "someone-else"},
    )
    assert patch.status_code == 422


def test_wardrobe_item_persists_across_new_db_session(client: TestClient) -> None:
    user_id, headers = _register_and_login(client, "wardpersist")
    created = client.post(
        "/wardrobe",
        headers=headers,
        json={
            "name": "  Emerald saree  ",
            "category": " dress ",
            "color": " emerald ",
            "notes": " festive ",
            "availability": "packed_away",
        },
    )
    assert created.status_code == 201
    item_id = created.json()["id"]
    assert created.json()["name"] == "Emerald saree"
    assert created.json()["category"] == "dress"
    assert created.json()["color"] == "emerald"
    assert created.json()["notes"] == "festive"

    session = get_session_factory()()
    try:
        row = session.scalar(
            select(WardrobeItem).where(
                WardrobeItem.id == item_id,
                WardrobeItem.owner_id == user_id,
            )
        )
        assert row is not None
        assert row.name == "Emerald saree"
        assert row.category == "dress"
        assert row.color == "emerald"
        assert row.notes == "festive"
        assert row.availability == "packed_away"
    finally:
        session.close()
