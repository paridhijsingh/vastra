"""Trend Stylist tests. Tavily and Nemotron are mocked and do not contact providers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from vastra.config import clear_settings_cache
from vastra.nemotron import ChatResult, NemotronCallError
from vastra.trends import (
    DEFAULT_TREND_MODEL,
    TAVILY_SEARCH_URL,
    TREND_MAX_OUTPUT_TOKENS,
    TREND_REQUEST_EXTRA,
    UNAVAILABLE_DETAIL,
    build_search_query,
    northern_meteorological_season,
    parse_tavily_results,
    sanitize_outfit_idea,
    search_tavily,
)

PASSWORD = "securepass1"
OCCASION = "dinner with friends"
VIBE = "relaxed"
BUDGET = "no shopping"
FIXED_NOW = datetime(2026, 10, 28, 19, 0, tzinfo=timezone.utc)
RETRIEVED = "2026-10-28"
TAVILY_URL = "https://example.com/fall-evening-looks"
TAVILY_TITLE = "Fall evening looks 2026"
SOURCE_SNIPPET = "Tailored wool trousers and a cream knit are common for relaxed dinners."


def _login(client: TestClient, username: str) -> dict[str, str]:
    assert client.post("/auth/register", json={"username": username, "password": PASSWORD}).status_code == 201
    login = client.post("/auth/login", json={"username": username, "password": PASSWORD})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _tavily_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "query": "fashion outfit trends autumn 2026 dinner with friends relaxed",
        "results": [
            {
                "title": TAVILY_TITLE,
                "url": TAVILY_URL,
                "content": SOURCE_SNIPPET,
                "published_date": "Mon, 12 Oct 2026 12:00:00 GMT",
            }
        ],
    }
    payload.update(overrides)
    return payload


def _patch_tavily(
    monkeypatch: pytest.MonkeyPatch,
    payload: dict[str, object] | None = None,
    *,
    error: Exception | None = None,
    status_code: int = 200,
) -> dict[str, object]:
    captured: dict[str, object] = {"calls": 0}

    class _Response:
        def __init__(self) -> None:
            self.status_code = status_code

        def json(self) -> dict[str, object]:
            if payload is None:
                raise ValueError("not json")
            return payload

    def fake(url: str, **kwargs: object) -> _Response:
        captured["calls"] = int(captured["calls"]) + 1
        captured["url"] = url
        captured["headers"] = kwargs.get("headers")
        captured["json"] = kwargs.get("json")
        if error:
            raise error
        return _Response()

    monkeypatch.setattr("vastra.trends._httpx_post", fake)
    return captured


def _patch_model(
    monkeypatch: pytest.MonkeyPatch,
    payload: dict[str, object] | None = None,
    *,
    chat: ChatResult | None = None,
    error: Exception | None = None,
) -> dict[str, object]:
    captured: dict[str, object] = {"calls": 0}

    def fake(
        config: object,
        messages: list[dict[str, str]],
        *,
        max_tokens: int,
        client: object = None,
        extra_body: object = None,
    ) -> ChatResult:
        captured["calls"] = int(captured["calls"]) + 1
        captured["messages"] = messages
        captured["max_tokens"] = max_tokens
        captured["model"] = getattr(config, "model", None)
        captured["timeout"] = getattr(config, "timeout_seconds", None)
        captured["extra_body"] = extra_body
        if error:
            raise error
        if chat is not None:
            return chat
        return ChatResult(text=json.dumps(payload), truncated=False, finish_reason="stop")

    monkeypatch.setattr("vastra.trends.request_chat_completion", fake)
    return captured


def _freeze_now(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("vastra.trends.datetime", SimpleNamespace(now=lambda tz=None: FIXED_NOW))


def test_season_and_query_include_occasion_vibe_and_current_year() -> None:
    assert northern_meteorological_season(10) == "autumn"
    query = build_search_query(OCCASION, VIBE, now=FIXED_NOW)
    assert query == "fashion outfit trends autumn 2026 dinner with friends relaxed"
    assert BUDGET not in query


def test_parse_tavily_keeps_http_urls_and_skips_invalid() -> None:
    sources = parse_tavily_results(
        {
            "results": [
                {
                    "title": TAVILY_TITLE,
                    "url": TAVILY_URL,
                    "content": SOURCE_SNIPPET,
                    "published_date": "Mon, 12 Oct 2026 12:00:00 GMT",
                },
                {"title": "bad", "url": "javascript:alert(1)", "content": "nope"},
                {"title": "missing url", "content": "nope"},
            ]
        },
        retrieved_date=RETRIEVED,
    )
    assert len(sources) == 1
    assert sources[0].url == TAVILY_URL
    assert sources[0].published_date == "Mon, 12 Oct 2026 12:00:00 GMT"
    assert sources[0].retrieved_date == RETRIEVED


def test_sanitize_drops_links_and_prices_absent_from_sources() -> None:
    from vastra.trends import RetrievedSource

    sources = [
        RetrievedSource(
            title=TAVILY_TITLE,
            url=TAVILY_URL,
            published_date=None,
            retrieved_date=RETRIEVED,
            content=SOURCE_SNIPPET,
        )
    ]
    cleaned = sanitize_outfit_idea(
        "Cream knit and wool trousers. Buy at https://shop.example/product for $49.",
        sources,
    )
    assert "https://" not in cleaned
    assert "$49" not in cleaned
    assert "shop.example" not in cleaned
    assert "Cream knit and wool trousers." in cleaned


def test_unauthenticated_trends_is_401(client: TestClient) -> None:
    response = client.post("/trends", json={"occasion": OCCASION, "vibe": VIBE, "budget": BUDGET})
    assert response.status_code == 401


def test_missing_tavily_key_is_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setenv("TAVILY_API_KEY", "")
    clear_settings_cache()
    headers = _login(client, "trend-nokey")
    caplog.set_level("WARNING", logger="vastra.trends")
    model = _patch_model(monkeypatch, {"outfit_idea": "A cream knit."})
    response = client.post(
        "/trends",
        headers=headers,
        json={"occasion": OCCASION, "vibe": VIBE, "budget": BUDGET},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == UNAVAILABLE_DETAIL
    assert model["calls"] == 0
    assert "tvly-" not in caplog.text


def test_tavily_failure_does_not_call_the_model(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    headers = _login(client, "trend-tavily-fail")
    _freeze_now(monkeypatch)
    _patch_tavily(monkeypatch, status_code=401)
    model = _patch_model(monkeypatch, {"outfit_idea": "Invented look."})
    caplog.set_level("WARNING", logger="vastra.trends")
    response = client.post(
        "/trends",
        headers=headers,
        json={"occasion": OCCASION, "vibe": VIBE, "budget": BUDGET},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == UNAVAILABLE_DETAIL
    assert model["calls"] == 0
    assert "result_count=0" in caplog.text
    assert "tvly-" not in caplog.text
    assert "test-only-not-a-real-tavily-key" not in caplog.text


def test_empty_tavily_results_are_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    headers = _login(client, "trend-empty")
    _freeze_now(monkeypatch)
    tavily = _patch_tavily(monkeypatch, _tavily_payload(results=[]))
    model = _patch_model(monkeypatch, {"outfit_idea": "Invented look."})
    caplog.set_level("WARNING", logger="vastra.trends")
    response = client.post(
        "/trends",
        headers=headers,
        json={"occasion": OCCASION, "vibe": VIBE, "budget": BUDGET},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == UNAVAILABLE_DETAIL
    assert tavily["calls"] == 1
    assert model["calls"] == 0
    assert "result_count=0" in caplog.text


def test_nemotron_failure_is_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = _login(client, "trend-model-fail")
    _freeze_now(monkeypatch)
    _patch_tavily(monkeypatch, _tavily_payload())
    _patch_model(monkeypatch, error=NemotronCallError("failed", "unavailable"))
    response = client.post(
        "/trends",
        headers=headers,
        json={"occasion": OCCASION, "vibe": VIBE, "budget": BUDGET},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == UNAVAILABLE_DETAIL


def test_successful_trend_uses_ultra_and_returns_only_tavily_sources(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    headers = _login(client, "trend-ok")
    _freeze_now(monkeypatch)
    tavily = _patch_tavily(monkeypatch, _tavily_payload())
    idea = "A cream knit with tailored wool trousers for a relaxed dinner."
    model = _patch_model(monkeypatch, {"outfit_idea": idea})
    caplog.set_level("WARNING", logger="vastra.trends")

    response = client.post(
        "/trends",
        headers=headers,
        json={"occasion": OCCASION, "vibe": VIBE, "budget": BUDGET},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["outfit_idea"] == idea
    assert body["retrieval_date"] == RETRIEVED
    assert body["sources"] == [
        {
            "title": TAVILY_TITLE,
            "url": TAVILY_URL,
            "published_date": "Mon, 12 Oct 2026 12:00:00 GMT",
            "retrieved_date": RETRIEVED,
        }
    ]
    assert tavily["url"] == TAVILY_SEARCH_URL
    request_json = tavily["json"]
    assert isinstance(request_json, dict)
    assert request_json["query"] == "fashion outfit trends autumn 2026 dinner with friends relaxed"
    assert request_json["search_depth"] == "basic"
    assert BUDGET not in request_json["query"]
    headers_sent = tavily["headers"]
    assert isinstance(headers_sent, dict)
    assert "test-only-not-a-real-tavily-key" not in caplog.text
    assert "tavily query=fashion outfit trends autumn 2026 dinner with friends relaxed result_count=1" in caplog.text
    assert model["model"] == DEFAULT_TREND_MODEL
    assert model["max_tokens"] == TREND_MAX_OUTPUT_TOKENS
    assert model["extra_body"] == TREND_REQUEST_EXTRA
    user_payload = json.loads(str(model["messages"][1]["content"]).split("\n", 1)[1])
    assert user_payload["budget"] == BUDGET
    assert user_payload["sources"][0]["url"] == TAVILY_URL
    assert user_payload["sources"][0]["title"] == TAVILY_TITLE
    assert "not a saved-wardrobe request" in str(model["messages"][0]["content"])


def test_model_invented_link_is_stripped_from_idea(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = _login(client, "trend-strip")
    _freeze_now(monkeypatch)
    _patch_tavily(monkeypatch, _tavily_payload())
    _patch_model(
        monkeypatch,
        {
            "outfit_idea": (
                f"Wear a cream knit. Shop https://shop.example/item and also {TAVILY_URL}."
            )
        },
    )
    response = client.post(
        "/trends",
        headers=headers,
        json={"occasion": OCCASION, "vibe": VIBE, "budget": BUDGET},
    )
    assert response.status_code == 200
    idea = response.json()["outfit_idea"]
    assert "shop.example" not in idea
    assert "https://" not in idea
    assert response.json()["sources"][0]["url"] == TAVILY_URL


def test_blank_fields_are_422(client: TestClient) -> None:
    headers = _login(client, "trend-blank")
    response = client.post(
        "/trends",
        headers=headers,
        json={"occasion": " ", "vibe": VIBE, "budget": BUDGET},
    )
    assert response.status_code == 422


def test_search_tavily_posts_bearer_header_without_key_in_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _patch_tavily(monkeypatch, _tavily_payload())
    sources = search_tavily("tvly-test-key", "fashion outfit trends autumn 2026", retrieved_date=RETRIEVED)
    assert len(sources) == 1
    headers = captured["headers"]
    assert isinstance(headers, dict)
    assert headers["Authorization"] == "Bearer tvly-test-key"
    body = captured["json"]
    assert isinstance(body, dict)
    assert "api_key" not in body
    assert "tvly-test-key" not in json.dumps(body)
