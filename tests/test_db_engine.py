"""Engine construction options. Does not connect to Postgres or any network database."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine as sqlalchemy_create_engine
from sqlalchemy import text
from sqlalchemy.pool import NullPool

from vastra.config import clear_settings_cache
from vastra.db import get_engine, reset_db_state

_TEST_SECRET = "test-only-secret-key-not-for-production-use"
_PSYCOPG_URL = "postgresql+psycopg://vastra:unused@127.0.0.1:6543/postgres"


@pytest.fixture
def isolated_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", _TEST_SECRET)
    monkeypatch.setenv("JWT_EXPIRE_HOURS", "72")
    clear_settings_cache()
    reset_db_state()
    yield
    reset_db_state()
    clear_settings_cache()


def _capture_create_engine(monkeypatch: pytest.MonkeyPatch, *, pass_through: bool) -> dict[str, Any]:
    captured: dict[str, Any] = {}

    def fake_create_engine(url: str, **kwargs: Any):
        captured["url"] = url
        captured["kwargs"] = kwargs
        if pass_through:
            engine = sqlalchemy_create_engine(url, **kwargs)
        else:
            # Do not load psycopg or open a network connection.
            engine = sqlalchemy_create_engine("sqlite://")
        captured["engine"] = engine
        return engine

    monkeypatch.setattr("vastra.db.create_engine", fake_create_engine)
    return captured


def test_psycopg_url_uses_null_pool_and_disables_prepared_statements(
    isolated_settings: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", _PSYCOPG_URL)
    clear_settings_cache()
    captured = _capture_create_engine(monkeypatch, pass_through=False)

    engine = get_engine()
    try:
        assert captured["url"] == _PSYCOPG_URL
        assert captured["kwargs"]["poolclass"] is NullPool
        assert captured["kwargs"]["connect_args"] == {"prepare_threshold": None}
        assert "check_same_thread" not in captured["kwargs"]["connect_args"]
        assert engine is captured["engine"]
    finally:
        engine.dispose()


def test_sqlite_url_keeps_check_same_thread_and_skips_postgres_options(
    isolated_settings: None,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "engine.db"
    sqlite_url = f"sqlite:///{db_path}"
    monkeypatch.setenv("DATABASE_URL", sqlite_url)
    clear_settings_cache()
    captured = _capture_create_engine(monkeypatch, pass_through=True)

    engine = get_engine()
    try:
        assert captured["url"] == sqlite_url
        assert captured["kwargs"].get("poolclass") is not NullPool
        assert "poolclass" not in captured["kwargs"]
        assert captured["kwargs"]["connect_args"] == {"check_same_thread": False}
        assert engine.dialect.name == "sqlite"
        with engine.connect() as connection:
            assert connection.execute(text("PRAGMA foreign_keys")).scalar() == 1
    finally:
        engine.dispose()
