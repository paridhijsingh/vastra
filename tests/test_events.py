"""Private saved events. No model calls and no wardrobe copies."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from vastra.db import get_session_factory
from vastra.models import SavedLook, WardrobeItem

SECRET_LOOK = "secret-look-name"


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


def _add_item(client: TestClient, headers: dict[str, str]) -> str:
    created = client.post(
        "/wardrobe",
        headers=headers,
        json={
            "name": "Kurta",
            "category": "top",
            "color": "navy",
            "notes": "private-hem",
            "availability": "available",
        },
    )
    assert created.status_code == 201
    return created.json()["id"]


def _add_look(client: TestClient, headers: dict[str, str], item_id: str, name: str = "Dinner") -> str:
    created = client.post(
        "/looks",
        headers=headers,
        json={"name": name, "item_ids": [item_id]},
    )
    assert created.status_code == 201
    return created.json()["id"]


def test_create_list_order_and_persistence(client: TestClient) -> None:
    _user_id, headers = _register_and_login(client, "event-owner")
    later = client.post(
        "/events",
        headers=headers,
        json={"name": "  Reception  ", "event_date": "2026-12-01", "occasion": "  party  "},
    )
    sooner = client.post(
        "/events",
        headers=headers,
        json={
            "name": "Dinner",
            "event_date": "2026-11-02",
            "comfort_needs": [" breathable ", "soft"],
        },
    )
    assert later.status_code == 201
    assert sooner.status_code == 201
    assert "owner_id" not in sooner.json()
    assert sooner.json()["name"] == "Dinner"
    assert sooner.json()["comfort_needs"] == ["breathable", "soft"]
    assert sooner.json()["look_id"] is None
    assert sooner.json()["look_name"] is None
    assert later.json()["occasion"] == "party"

    same_day = client.post(
        "/events",
        headers=headers,
        json={"name": "Lunch", "event_date": "2026-11-02"},
    )
    assert same_day.status_code == 201
    listed = client.get("/events", headers=headers)
    november = [event["id"] for event in listed.json() if event["event_date"] == "2026-11-02"]
    assert november == sorted(november)
    assert [event["event_date"] for event in listed.json()] == ["2026-11-02", "2026-11-02", "2026-12-01"]

    again = client.post("/auth/login", json={"username": "event-owner", "password": "securepass1"})
    fresh = {"Authorization": f"Bearer {again.json()['access_token']}"}
    fetched = client.get(f"/events/{sooner.json()['id']}", headers=fresh)
    assert fetched.status_code == 200
    assert fetched.json()["event_date"] == "2026-11-02"


def test_authentication_and_account_isolation(client: TestClient) -> None:
    _owner, owner_headers = _register_and_login(client, "event-a")
    _other, other_headers = _register_and_login(client, "event-b")
    created = client.post(
        "/events",
        headers=owner_headers,
        json={"name": "Mine", "event_date": "2026-11-02"},
    )
    event_id = created.json()["id"]

    for path, method, payload in (
        ("/events", "get", None),
        ("/events", "post", {"name": "Nope", "event_date": "2026-11-02"}),
        (f"/events/{event_id}", "get", None),
        (f"/events/{event_id}", "patch", {"name": "Stolen"}),
        (f"/events/{event_id}", "delete", None),
    ):
        response = client.request(method, path, json=payload)
        assert response.status_code == 401

    assert client.get("/events", headers=other_headers).json() == []
    foreign = client.get(f"/events/{event_id}", headers=other_headers)
    missing = client.get("/events/missing-event", headers=owner_headers)
    assert foreign.status_code == missing.status_code == 404
    assert foreign.json()["detail"] == missing.json()["detail"] == "Event not found."
    assert client.patch(
        f"/events/{event_id}",
        headers=other_headers,
        json={"name": "Stolen"},
    ).status_code == 404
    assert client.get(f"/events/{event_id}", headers=owner_headers).json()["name"] == "Mine"


def test_validation_and_partial_update(client: TestClient) -> None:
    _user_id, headers = _register_and_login(client, "event-valid")
    created = client.post(
        "/events",
        headers=headers,
        json={
            "name": "Dinner",
            "event_date": "2026-11-02",
            "occasion": "party",
            "notes": "standing",
            "comfort_needs": ["breathable"],
        },
    )
    event_id = created.json()["id"]

    assert client.post(
        "/events",
        headers=headers,
        json={"name": "Dinner", "event_date": "2026-11-02T18:00:00", "owner_id": "spoof"},
    ).status_code == 422
    timed = client.post(
        "/events",
        headers=headers,
        json={"name": "Dinner", "event_date": "2026-02-31"},
    )
    assert timed.status_code == 422
    assert "2026-02-31" not in timed.text
    located = client.post(
        "/events",
        headers=headers,
        json={"name": "Dinner", "event_date": "2026-11-02", "latitude": 12.3},
    )
    assert located.status_code == 422
    assert "12.3" not in located.text

    renamed = client.patch(f"/events/{event_id}", headers=headers, json={"name": "  Evening  "})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Evening"
    assert renamed.json()["event_date"] == "2026-11-02"
    assert renamed.json()["occasion"] == "party"
    assert renamed.json()["comfort_needs"] == ["breathable"]

    cleared = client.patch(
        f"/events/{event_id}",
        headers=headers,
        json={"occasion": "  ", "notes": None, "comfort_needs": []},
    )
    assert cleared.status_code == 200
    assert cleared.json()["name"] == "Evening"
    assert cleared.json()["occasion"] is None
    assert cleared.json()["notes"] is None
    assert cleared.json()["comfort_needs"] == []

    assert client.patch(f"/events/{event_id}", headers=headers, json={}).status_code == 422
    assert client.patch(f"/events/{event_id}", headers=headers, json={"name": None}).status_code == 422
    assert client.patch(
        f"/events/{event_id}",
        headers=headers,
        json={"event_date": None},
    ).status_code == 422
    assert client.get(f"/events/{event_id}", headers=headers).json()["name"] == "Evening"


def test_look_attachment_rename_and_delete(client: TestClient) -> None:
    _owner, owner_headers = _register_and_login(client, "event-look")
    _other, other_headers = _register_and_login(client, "event-look-other")
    item_id = _add_item(client, owner_headers)
    look_id = _add_look(client, owner_headers, item_id, name="Dinner")
    foreign_item = _add_item(client, other_headers)
    foreign_look = _add_look(client, other_headers, foreign_item, name=SECRET_LOOK)

    unknown = client.post(
        "/events",
        headers=owner_headers,
        json={"name": "Missing", "event_date": "2026-11-02", "look_id": "missing-look"},
    )
    foreign = client.post(
        "/events",
        headers=owner_headers,
        json={"name": "Foreign", "event_date": "2026-11-02", "look_id": foreign_look},
    )
    assert unknown.status_code == foreign.status_code == 404
    assert unknown.json()["detail"] == foreign.json()["detail"] == "Saved look not found."
    assert SECRET_LOOK not in foreign.text
    assert client.get("/events", headers=owner_headers).json() == []

    created = client.post(
        "/events",
        headers=owner_headers,
        json={"name": "Dinner out", "event_date": "2026-11-02", "look_id": look_id},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["look_id"] == look_id
    assert body["look_name"] == "Dinner"
    assert "private-hem" not in created.text
    assert "navy" not in created.text
    event_id = body["id"]

    renamed = client.patch(f"/looks/{look_id}", headers=owner_headers, json={"name": "Evening wear"})
    assert renamed.status_code == 200
    refreshed = client.get(f"/events/{event_id}", headers=owner_headers)
    assert refreshed.json()["look_name"] == "Evening wear"
    assert refreshed.json()["look_id"] == look_id

    detached = client.patch(f"/events/{event_id}", headers=owner_headers, json={"look_id": None})
    assert detached.status_code == 200
    assert detached.json()["look_id"] is None
    assert detached.json()["look_name"] is None
    assert client.get(f"/looks/{look_id}", headers=owner_headers).status_code == 200

    reattached = client.patch(
        f"/events/{event_id}",
        headers=owner_headers,
        json={"look_id": look_id},
    )
    assert reattached.json()["look_name"] == "Evening wear"
    assert client.delete(f"/looks/{look_id}", headers=owner_headers).status_code == 204
    preserved = client.get(f"/events/{event_id}", headers=owner_headers)
    assert preserved.status_code == 200
    assert preserved.json()["name"] == "Dinner out"
    assert preserved.json()["look_id"] is None
    assert preserved.json()["look_name"] is None
    assert client.get(f"/wardrobe/{item_id}", headers=owner_headers).status_code == 200


def test_deleting_an_event_keeps_the_look_and_wardrobe(client: TestClient) -> None:
    _user_id, headers = _register_and_login(client, "event-delete")
    item_id = _add_item(client, headers)
    look_id = _add_look(client, headers, item_id)
    created = client.post(
        "/events",
        headers=headers,
        json={"name": "Dinner", "event_date": "2026-11-02", "look_id": look_id},
    )
    deleted = client.delete(f"/events/{created.json()['id']}", headers=headers)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(f"/looks/{look_id}", headers=headers).status_code == 200
    assert client.get(f"/wardrobe/{item_id}", headers=headers).status_code == 200
    session = get_session_factory()()
    try:
        assert session.get(SavedLook, look_id) is not None
        assert session.get(WardrobeItem, item_id) is not None
    finally:
        session.close()


def test_events_make_no_model_calls(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("model called")

    monkeypatch.setattr("vastra.nemotron.request_chat_completion", fail)
    monkeypatch.setattr("vastra.outfits.request_chat_completion", fail)
    _user_id, headers = _register_and_login(client, "event-nomodel")
    created = client.post(
        "/events",
        headers=headers,
        json={"name": "Dinner", "event_date": "2026-11-02"},
    )
    event_id = created.json()["id"]
    assert client.get("/events", headers=headers).status_code == 200
    assert client.patch(f"/events/{event_id}", headers=headers, json={"notes": "later"}).status_code == 200
    assert client.delete(f"/events/{event_id}", headers=headers).status_code == 204
