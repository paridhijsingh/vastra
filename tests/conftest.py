"""Shared pytest fixtures."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from vastra.config import clear_settings_cache
from vastra.db import reset_db_state


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("SECRET_KEY", "test-only-secret-key-not-for-production-use")
    monkeypatch.setenv("JWT_EXPIRE_HOURS", "72")
    clear_settings_cache()
    reset_db_state()

    from vastra.api import app

    with TestClient(app) as test_client:
        yield test_client

    reset_db_state()
    clear_settings_cache()
