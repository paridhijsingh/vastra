"""Auth and database foundation tests (temporary SQLite database)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient


def test_register_and_login(client: TestClient) -> None:
    register = client.post(
        "/auth/register",
        json={"username": "stylefan", "password": "securepass1"},
    )
    assert register.status_code == 201
    body = register.json()
    assert body["username"] == "stylefan"
    assert "id" in body
    assert "password" not in body
    assert "password_hash" not in body

    login = client.post(
        "/auth/login",
        json={"username": "stylefan", "password": "securepass1"},
    )
    assert login.status_code == 200
    token_body = login.json()
    assert "access_token" in token_body
    assert token_body["token_type"] == "bearer"
    assert "password" not in token_body


def test_duplicate_username_rejected(client: TestClient) -> None:
    payload = {"username": "dupuser", "password": "securepass1"}
    assert client.post("/auth/register", json=payload).status_code == 201
    again = client.post("/auth/register", json=payload)
    assert again.status_code == 409
    assert again.json()["detail"] == "Username already registered"


def test_incorrect_password_rejected(client: TestClient) -> None:
    client.post(
        "/auth/register",
        json={"username": "loginfan", "password": "securepass1"},
    )
    bad = client.post(
        "/auth/login",
        json={"username": "loginfan", "password": "wrong-password"},
    )
    assert bad.status_code == 401
    assert bad.json()["detail"] == "Incorrect username or password"


def test_missing_token_rejected(client: TestClient) -> None:
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_invalid_token_rejected(client: TestClient) -> None:
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert response.status_code == 401


def test_expired_token_rejected(client: TestClient) -> None:
    registered = client.post(
        "/auth/register",
        json={"username": "expiring", "password": "securepass1"},
    )
    user_id = registered.json()["id"]
    expired = jwt.encode(
        {
            "sub": user_id,
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        "test-only-secret-key-not-for-production-use",
        algorithm="HS256",
    )
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert response.status_code == 401


def test_auth_me_returns_current_user(client: TestClient) -> None:
    registered = client.post(
        "/auth/register",
        json={"username": "meuser", "password": "securepass1"},
    )
    user = registered.json()
    login = client.post(
        "/auth/login",
        json={"username": "meuser", "password": "securepass1"},
    )
    token = login.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["id"] == user["id"]
    assert body["username"] == "meuser"
    assert "password" not in body
    assert "password_hash" not in body


def test_short_password_validation_omits_submitted_value(client: TestClient) -> None:
    short_password = "ab12"  # below RegisterRequest min_length=8
    response = client.post(
        "/auth/register",
        json={"username": "shortpassuser", "password": short_password},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, list)
    assert any(
        isinstance(err, dict) and "password" in err.get("loc", [])
        for err in detail
    )
    assert short_password not in response.text
    for err in detail:
        assert "input" not in err
        assert "ctx" not in err


def test_health_and_root_still_work(client: TestClient) -> None:
    assert client.get("/").json() == {"name": "Vastra AI", "status": "running"}
    assert client.get("/health").json() == {"status": "ok"}
