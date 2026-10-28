"""Shared pytest fixtures."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from vastra.config import clear_settings_cache
from vastra.db import reset_db_state

LIVE_MODEL_CLIENT_BLOCKED = "live model client is not allowed in tests"
LIVE_TAVILY_BLOCKED = "live tavily is not allowed in tests"
# Overrides a checkout .env. Not a real credential; OpenAI construction is still refused.
TEST_NEBIUS_API_KEY = "test-only-not-a-real-nebius-key"
TEST_TAVILY_API_KEY = "test-only-not-a-real-tavily-key"


def _refuse_live_model_client(*_args: object, **_kwargs: object) -> None:
    raise AssertionError(LIVE_MODEL_CLIENT_BLOCKED)


@pytest.fixture(autouse=True)
def block_live_model_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """Override any real provider key and refuse SDK construction before a network client exists.

    Tests install a fake completion client or patch request_chat_completion. They
    must not construct the real OpenAI client.
    """
    monkeypatch.setenv("NEBIUS_API_KEY", TEST_NEBIUS_API_KEY)
    monkeypatch.setenv("TAVILY_API_KEY", TEST_TAVILY_API_KEY)
    monkeypatch.setenv("DEMO_EMAIL", "")
    monkeypatch.setenv("DEMO_PASSWORD", "")
    clear_settings_cache()
    monkeypatch.setattr("vastra.nemotron.OpenAI", _refuse_live_model_client)
    monkeypatch.setattr("vastra.nemotron.build_client", _refuse_live_model_client)
    import vastra.trends as trends_mod

    def _refuse_live_tavily(*_args: object, **_kwargs: object) -> None:
        raise AssertionError(LIVE_TAVILY_BLOCKED)

    monkeypatch.setattr(trends_mod, "_httpx_post", _refuse_live_tavily)
    eval_mod = sys.modules.get("scripts.evaluate_stylist_models")
    if eval_mod is not None:
        monkeypatch.setattr(eval_mod, "build_client", _refuse_live_model_client)
    yield
    clear_settings_cache()


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
