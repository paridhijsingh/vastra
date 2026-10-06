"""Authenticated style profile API tests (temporary SQLite database)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from vastra.db import get_session_factory
from vastra.models import StyleProfile

PROFILE_A = {
    "styling_preference": "women",
    "preferred_styles": ["Indian", "fusion"],
    "preferred_colors": ["navy", "cream"],
    "fit_preferences": ["tailored"],
    "comfort_preferences": ["breathable fabrics"],
    "clothing_to_avoid": ["stilettos"],
}

PROFILE_A_REPLACED = {
    "styling_preference": "unisex",
    "preferred_styles": ["Western"],
    "preferred_colors": ["black"],
    "fit_preferences": ["relaxed"],
    "comfort_preferences": [],
    "clothing_to_avoid": ["itchy wool", "tight collars"],
}

PROFILE_B = {
    "styling_preference": "men",
    "preferred_styles": ["Western"],
    "preferred_colors": ["olive"],
    "fit_preferences": ["straight"],
    "comfort_preferences": ["soft soles"],
    "clothing_to_avoid": [],
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


def test_create_retrieve_replace_and_delete_profile(client: TestClient) -> None:
    user_id, headers = _register_and_login(client, "profileowner")

    missing = client.get("/profile", headers=headers)
    assert missing.status_code == 404

    created = client.put("/profile", headers=headers, json=PROFILE_A)
    assert created.status_code == 200
    body = created.json()
    assert body["owner_id"] == user_id
    assert body["styling_preference"] == "women"
    assert body["preferred_styles"] == ["Indian", "fusion"]
    assert body["preferred_colors"] == ["navy", "cream"]

    fetched = client.get("/profile", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json() == body

    replaced = client.put("/profile", headers=headers, json=PROFILE_A_REPLACED)
    assert replaced.status_code == 200
    assert replaced.json()["styling_preference"] == "unisex"
    assert replaced.json()["preferred_styles"] == ["Western"]
    assert replaced.json()["comfort_preferences"] == []
    assert replaced.json()["clothing_to_avoid"] == ["itchy wool", "tight collars"]

    deleted = client.delete("/profile", headers=headers)
    assert deleted.status_code == 204
    assert deleted.content == b""

    assert client.get("/profile", headers=headers).status_code == 404

    deleted_again = client.delete("/profile", headers=headers)
    assert deleted_again.status_code == 204
    assert deleted_again.content == b""


def test_repeated_put_does_not_create_duplicates(client: TestClient) -> None:
    user_id, headers = _register_and_login(client, "onedup")
    assert client.put("/profile", headers=headers, json=PROFILE_A).status_code == 200
    assert client.put("/profile", headers=headers, json=PROFILE_A_REPLACED).status_code == 200
    assert client.put("/profile", headers=headers, json=PROFILE_A).status_code == 200

    session = get_session_factory()()
    try:
        count = session.scalar(
            select(func.count()).select_from(StyleProfile).where(StyleProfile.owner_id == user_id)
        )
        assert count == 1
    finally:
        session.close()


def test_two_users_have_independent_profiles(client: TestClient) -> None:
    user_a, headers_a = _register_and_login(client, "usera")
    user_b, headers_b = _register_and_login(client, "userb")

    assert client.put("/profile", headers=headers_a, json=PROFILE_A).status_code == 200
    assert client.put("/profile", headers=headers_b, json=PROFILE_B).status_code == 200

    profile_a = client.get("/profile", headers=headers_a).json()
    profile_b = client.get("/profile", headers=headers_b).json()
    assert profile_a["owner_id"] == user_a
    assert profile_b["owner_id"] == user_b
    assert profile_a["styling_preference"] == "women"
    assert profile_b["styling_preference"] == "men"
    assert profile_a["preferred_colors"] != profile_b["preferred_colors"]


def test_unauthenticated_profile_access_rejected(client: TestClient) -> None:
    assert client.get("/profile").status_code == 401
    assert client.put("/profile", json=PROFILE_A).status_code == 401
    assert client.delete("/profile").status_code == 401


def test_invalid_enum_and_blank_list_entries_rejected(client: TestClient) -> None:
    _, headers = _register_and_login(client, "validator")

    bad_pref = client.put(
        "/profile",
        headers=headers,
        json={**PROFILE_A, "styling_preference": "kids"},
    )
    assert bad_pref.status_code == 422

    bad_style = client.put(
        "/profile",
        headers=headers,
        json={**PROFILE_A, "preferred_styles": ["Boho"]},
    )
    assert bad_style.status_code == 422

    blank_color = client.put(
        "/profile",
        headers=headers,
        json={**PROFILE_A, "preferred_colors": ["navy", "  "]},
    )
    assert blank_color.status_code == 422
    assert "preferred_colors" in blank_color.text


def test_client_supplied_owner_id_rejected(client: TestClient) -> None:
    user_id, headers = _register_and_login(client, "nospoof")
    response = client.put(
        "/profile",
        headers=headers,
        json={**PROFILE_A, "owner_id": "someone-else"},
    )
    assert response.status_code == 422
    assert any(
        isinstance(err, dict) and "owner_id" in err.get("loc", [])
        for err in response.json()["detail"]
    )

    saved = client.put("/profile", headers=headers, json=PROFILE_A)
    assert saved.status_code == 200
    assert saved.json()["owner_id"] == user_id


def test_profile_persists_across_new_db_session(client: TestClient) -> None:
    user_id, headers = _register_and_login(client, "persist")
    trimmed_payload = {
        **PROFILE_A,
        "preferred_colors": ["  emerald  ", "ivory"],
        "fit_preferences": [" tailored "],
    }
    saved = client.put("/profile", headers=headers, json=trimmed_payload)
    assert saved.status_code == 200
    assert saved.json()["preferred_colors"] == ["emerald", "ivory"]
    assert saved.json()["fit_preferences"] == ["tailored"]

    session = get_session_factory()()
    try:
        row = session.scalar(select(StyleProfile).where(StyleProfile.owner_id == user_id))
        assert row is not None
        assert row.styling_preference == "women"
        assert row.preferred_styles == ["Indian", "fusion"]
        assert row.preferred_colors == ["emerald", "ivory"]
        assert row.fit_preferences == ["tailored"]
        assert row.comfort_preferences == ["breathable fabrics"]
        assert row.clothing_to_avoid == ["stilettos"]
    finally:
        session.close()
