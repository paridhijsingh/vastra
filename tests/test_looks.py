"""Private saved looks. No model calls."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from vastra.db import get_session_factory
from vastra.models import SavedLook, SavedLookItem

SECRET_NOTES = "private-hem-note-do-not-copy"


def _register_and_login(client: TestClient, username: str) -> tuple[str, dict[str, str]]:
    registered = client.post(
        "/auth/register",
        json={"username": username, "password": "securepass1"},
    )
    assert registered.status_code == 201
    login = client.post(
        "/auth/login",
        json={"username": username, "password": "securepass1"},
    )
    assert login.status_code == 200
    return registered.json()["id"], {"Authorization": f"Bearer {login.json()['access_token']}"}


def _add_item(
    client: TestClient,
    headers: dict[str, str],
    *,
    name: str,
    category: str,
    availability: str = "available",
    notes: str = "",
    color: str = "navy",
) -> str:
    created = client.post(
        "/wardrobe",
        headers=headers,
        json={
            "name": name,
            "category": category,
            "color": color,
            "notes": notes,
            "availability": availability,
        },
    )
    assert created.status_code == 201
    return created.json()["id"]


def test_create_ordered_retrieval_persists_across_sessions(client: TestClient) -> None:
    _user_id, headers = _register_and_login(client, "lookowner")
    top = _add_item(client, headers, name="Kurta", category="top")
    bottom = _add_item(client, headers, name="Trousers", category="bottom", color="black")
    shoes = _add_item(client, headers, name="Sandals", category="shoes", color="tan")

    created = client.post(
        "/looks",
        headers=headers,
        json={
            "name": "  Dinner  ",
            "occasion": "  dinner with friends  ",
            "notes": "  standing  ",
            "item_ids": [shoes, top, bottom],
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert "owner_id" not in body
    assert body["name"] == "Dinner"
    assert body["occasion"] == "dinner with friends"
    assert body["notes"] == "standing"
    assert body["contains_removed_items"] is False
    assert body["removed_item_notice"] is None
    assert [item["id"] for item in body["items"]] == [shoes, top, bottom]
    assert [item["name"] for item in body["items"]] == ["Sandals", "Kurta", "Trousers"]
    assert body["created_at"]
    look_id = body["id"]

    again = client.post(
        "/auth/login",
        json={"username": "lookowner", "password": "securepass1"},
    )
    fresh = {"Authorization": f"Bearer {again.json()['access_token']}"}
    listed = client.get("/looks", headers=fresh)
    assert listed.status_code == 200
    assert [look["id"] for look in listed.json()] == [look_id]

    session = get_session_factory()()
    try:
        stored = session.get(SavedLook, look_id)
        assert stored is not None
        assert stored.name == "Dinner"
        positions = session.query(SavedLookItem).filter_by(look_id=look_id).order_by(SavedLookItem.position).all()
        assert [slot.wardrobe_item_id for slot in positions] == [shoes, top, bottom]
        assert stored.owner_id
    finally:
        session.close()


def test_newest_look_is_listed_first(client: TestClient) -> None:
    _user_id, headers = _register_and_login(client, "lookorder")
    top = _add_item(client, headers, name="Kurta", category="top")
    first = client.post("/looks", headers=headers, json={"name": "First", "item_ids": [top]})
    second = client.post("/looks", headers=headers, json={"name": "Second", "item_ids": [top]})
    assert first.status_code == 201
    assert second.status_code == 201
    listed = client.get("/looks", headers=headers)
    assert [look["name"] for look in listed.json()] == ["Second", "First"]


def test_authentication_and_account_isolation(client: TestClient) -> None:
    _owner, owner_headers = _register_and_login(client, "look-a")
    _other, other_headers = _register_and_login(client, "look-b")
    top = _add_item(client, owner_headers, name="Kurta", category="top", notes=SECRET_NOTES)
    created = client.post(
        "/looks",
        headers=owner_headers,
        json={"name": "Mine", "item_ids": [top]},
    )
    look_id = created.json()["id"]

    for path, method, payload in (
        ("/looks", "get", None),
        ("/looks", "post", {"name": "Nope", "item_ids": [top]}),
        (f"/looks/{look_id}", "get", None),
        (f"/looks/{look_id}", "patch", {"name": "Stolen"}),
        (f"/looks/{look_id}", "delete", None),
    ):
        response = client.request(method, path, json=payload)
        assert response.status_code == 401

    assert client.get("/looks", headers=other_headers).json() == []
    for method, payload in (
        ("get", None),
        ("patch", {"name": "Stolen"}),
        ("delete", None),
    ):
        response = client.request(method, f"/looks/{look_id}", headers=other_headers, json=payload)
        assert response.status_code == 404
        assert response.json()["detail"] == "Saved look not found."
        assert SECRET_NOTES not in response.text

    assert client.get(f"/looks/{look_id}", headers=owner_headers).json()["name"] == "Mine"
    missing = client.get("/looks/does-not-exist", headers=owner_headers)
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Saved look not found."


def test_invalid_duplicate_unknown_and_foreign_item_ids(client: TestClient) -> None:
    _owner, owner_headers = _register_and_login(client, "look-valid")
    _other, other_headers = _register_and_login(client, "look-foreign")
    owned = _add_item(client, owner_headers, name="Kurta", category="top")
    foreign = _add_item(client, other_headers, name="Secret jacket", category="outerwear", notes=SECRET_NOTES)

    duplicate = client.post(
        "/looks",
        headers=owner_headers,
        json={"name": "Dup", "item_ids": [owned, owned]},
    )
    assert duplicate.status_code == 422

    blank = client.post(
        "/looks",
        headers=owner_headers,
        json={"name": "Blank", "item_ids": ["  "]},
    )
    assert blank.status_code == 422

    extra = client.post(
        "/looks",
        headers=owner_headers,
        json={"name": "Extra", "item_ids": [owned], "owner_id": "spoof"},
    )
    assert extra.status_code == 422
    assert "spoof" not in extra.text

    unknown = client.post(
        "/looks",
        headers=owner_headers,
        json={"name": "Missing", "item_ids": ["missing-item"]},
    )
    foreign_response = client.post(
        "/looks",
        headers=owner_headers,
        json={"name": "Foreign", "item_ids": [foreign]},
    )
    assert unknown.status_code == 404
    assert foreign_response.status_code == 404
    assert unknown.json()["detail"] == foreign_response.json()["detail"] == "Wardrobe item not found."
    assert SECRET_NOTES not in foreign_response.text
    assert "Secret jacket" not in foreign_response.text
    assert client.get("/looks", headers=owner_headers).json() == []


def test_unavailable_items_report_current_wardrobe_state(client: TestClient) -> None:
    _user_id, headers = _register_and_login(client, "look-laundry")
    laundry = _add_item(
        client,
        headers,
        name="Linen shirt",
        category="top",
        availability="in_laundry",
        notes="wrinkled",
        color="white",
    )
    packed = _add_item(
        client,
        headers,
        name="Coat",
        category="outerwear",
        availability="packed_away",
        color="grey",
    )
    created = client.post(
        "/looks",
        headers=headers,
        json={"name": "Travel", "item_ids": [laundry, packed]},
    )
    assert created.status_code == 201
    assert [item["availability"] for item in created.json()["items"]] == ["in_laundry", "packed_away"]

    edited = client.patch(
        f"/wardrobe/{laundry}",
        headers=headers,
        json={"color": "blue", "notes": "pressed", "availability": "available", "name": "Blue shirt"},
    )
    assert edited.status_code == 200
    reopened = client.get(f"/looks/{created.json()['id']}", headers=headers)
    shirt = reopened.json()["items"][0]
    assert shirt["name"] == "Blue shirt"
    assert shirt["color"] == "blue"
    assert shirt["notes"] == "pressed"
    assert shirt["availability"] == "available"
    assert shirt["category"] == "top"


def test_deleted_wardrobe_item_keeps_a_missing_marker(client: TestClient) -> None:
    _user_id, headers = _register_and_login(client, "look-delete-item")
    keep = _add_item(client, headers, name="Trousers", category="bottom")
    gone = _add_item(client, headers, name="Secret kurta", category="top", notes=SECRET_NOTES, color="red")
    shoes = _add_item(client, headers, name="Sandals", category="shoes")
    created = client.post(
        "/looks",
        headers=headers,
        json={"name": "Dinner", "item_ids": [keep, gone, shoes]},
    )
    look_id = created.json()["id"]
    assert client.delete(f"/wardrobe/{gone}", headers=headers).status_code == 204

    reopened = client.get(f"/looks/{look_id}", headers=headers)
    body = reopened.json()
    assert body["contains_removed_items"] is True
    assert body["removed_item_notice"] == "This look includes a wardrobe item that was removed."
    assert [item.get("missing") for item in body["items"]] == [False, True, False]
    assert body["items"][0]["name"] == "Trousers"
    assert body["items"][2]["name"] == "Sandals"
    assert "name" not in body["items"][1]
    assert "notes" not in body["items"][1]
    assert "id" not in body["items"][1]
    assert SECRET_NOTES not in reopened.text
    assert "Secret kurta" not in reopened.text
    assert "red" not in reopened.text

    session = get_session_factory()()
    try:
        slots = session.query(SavedLookItem).filter_by(look_id=look_id).order_by(SavedLookItem.position).all()
        assert [slot.position for slot in slots] == [0, 1, 2]
        assert slots[1].wardrobe_item_id is None
    finally:
        session.close()


def test_rename_clear_delete_and_invalid_patch(client: TestClient) -> None:
    _user_id, headers = _register_and_login(client, "look-patch")
    top = _add_item(client, headers, name="Kurta", category="top")
    created = client.post(
        "/looks",
        headers=headers,
        json={"name": "Dinner", "occasion": "party", "notes": "bring a jacket", "item_ids": [top]},
    )
    look_id = created.json()["id"]

    renamed = client.patch(f"/looks/{look_id}", headers=headers, json={"name": "  Evening  "})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Evening"
    assert renamed.json()["occasion"] == "party"
    assert renamed.json()["notes"] == "bring a jacket"
    assert renamed.json()["items"][0]["id"] == top

    cleared = client.patch(
        f"/looks/{look_id}",
        headers=headers,
        json={"occasion": "   ", "notes": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["name"] == "Evening"
    assert cleared.json()["occasion"] is None
    assert cleared.json()["notes"] is None

    empty = client.patch(f"/looks/{look_id}", headers=headers, json={})
    assert empty.status_code == 422
    blank_name = client.patch(f"/looks/{look_id}", headers=headers, json={"name": "  "})
    assert blank_name.status_code == 422
    null_name = client.patch(f"/looks/{look_id}", headers=headers, json={"name": None})
    assert null_name.status_code == 422
    items = client.patch(f"/looks/{look_id}", headers=headers, json={"item_ids": [top]})
    assert items.status_code == 422
    assert client.get(f"/looks/{look_id}", headers=headers).json()["name"] == "Evening"

    deleted = client.delete(f"/looks/{look_id}", headers=headers)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(f"/looks/{look_id}", headers=headers).status_code == 404
    assert client.get(f"/wardrobe/{top}", headers=headers).status_code == 200
    session = get_session_factory()()
    try:
        assert session.get(SavedLook, look_id) is None
        assert session.query(SavedLookItem).filter_by(look_id=look_id).count() == 0
    finally:
        session.close()


def test_saved_looks_make_no_model_calls(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("model called")

    monkeypatch.setattr("vastra.nemotron.request_chat_completion", fail)
    monkeypatch.setattr("vastra.outfits.request_chat_completion", fail)

    _user_id, headers = _register_and_login(client, "look-nomodel")
    top = _add_item(client, headers, name="Kurta", category="top")
    created = client.post("/looks", headers=headers, json={"name": "Dinner", "item_ids": [top]})
    look_id = created.json()["id"]
    assert client.get("/looks", headers=headers).status_code == 200
    assert client.get(f"/looks/{look_id}", headers=headers).status_code == 200
    assert client.patch(f"/looks/{look_id}", headers=headers, json={"notes": "later"}).status_code == 200
    assert client.delete(f"/looks/{look_id}", headers=headers).status_code == 204
