"""Offline checks for the Nebius smoke test. These tests do not call the API."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from vastra.config import clear_settings_cache, get_settings
from vastra.nemotron import (
    AUTH_MESSAGE,
    CONNECTION_MESSAGE,
    EMPTY_MESSAGE,
    INVALID_TIMEOUT_MESSAGE,
    MISSING_KEY_MESSAGE,
    RATE_LIMIT_MESSAGE,
    TIMEOUT_MESSAGE,
    TRUNCATED_MESSAGE,
    NEMOTRON_REQUEST_EXTRA,
    NemotronConfig,
    NemotronConfigError,
    TokenUsage,
    format_usage,
    parse_nemotron_env,
    public_call_error,
    request_chat_completion,
    run_styling_check,
)
from openai import APIConnectionError, APITimeoutError, AuthenticationError, RateLimitError


SECRET = "sk-test-secret-value-should-not-leak"


def _config() -> NemotronConfig:
    return NemotronConfig(
        api_key=SECRET,
        base_url="https://api.tokenfactory.nebius.com/v1/",
        model="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
        timeout_seconds=60,
    )


def _completion(text: str | None, finish_reason: str = "stop", usage: object | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                finish_reason=finish_reason,
                message=SimpleNamespace(content=text),
            )
        ],
        usage=usage,
    )


class _FakeClient:
    def __init__(self, response: object | None = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[dict[str, object]] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs: object) -> object:
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response


def test_missing_key_is_rejected_before_a_request() -> None:
    with pytest.raises(NemotronConfigError, match="NEBIUS_API_KEY") as exc:
        parse_nemotron_env({"NEMOTRON_MODEL": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"})
    assert SECRET not in exc.value.message
    assert exc.value.message == MISSING_KEY_MESSAGE


def test_invalid_timeout_and_blank_key_do_not_echo_values() -> None:
    with pytest.raises(NemotronConfigError) as exc:
        parse_nemotron_env({"NEBIUS_API_KEY": "  ", "NEMOTRON_TIMEOUT_SECONDS": "nope"})
    assert exc.value.message == MISSING_KEY_MESSAGE

    with pytest.raises(NemotronConfigError) as timeout_exc:
        parse_nemotron_env({"NEBIUS_API_KEY": SECRET, "NEMOTRON_TIMEOUT_SECONDS": "0"})
    assert timeout_exc.value.message == INVALID_TIMEOUT_MESSAGE
    assert SECRET not in timeout_exc.value.message


def test_defaults_are_applied_without_printing_the_key() -> None:
    config = parse_nemotron_env({"NEBIUS_API_KEY": SECRET})
    assert config.base_url == "https://api.tokenfactory.nebius.com/v1/"
    assert config.model == "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
    assert config.timeout_seconds == 60
    assert SECRET not in f"{config.base_url} {config.model}"


def _http_response(status: int) -> SimpleNamespace:
    return SimpleNamespace(status_code=status, request=SimpleNamespace(), headers={})


def test_provider_errors_are_sanitized() -> None:
    request = SimpleNamespace()
    auth = AuthenticationError(
        "Incorrect API key provided: " + SECRET,
        response=_http_response(401),
        body=None,
    )
    assert public_call_error(auth) == AUTH_MESSAGE
    assert SECRET not in public_call_error(auth)

    limited = RateLimitError("slow down " + SECRET, response=_http_response(429), body=None)
    assert public_call_error(limited) == RATE_LIMIT_MESSAGE
    assert SECRET not in public_call_error(limited)

    timed_out = APITimeoutError(request)
    assert public_call_error(timed_out) == TIMEOUT_MESSAGE
    refused = APIConnectionError(message="connection to " + SECRET + " failed", request=request)
    assert public_call_error(refused) == CONNECTION_MESSAGE
    assert SECRET not in public_call_error(refused)


def test_successful_check_prints_usage_and_bounds_the_request() -> None:
    client = _FakeClient(
        _completion(
            "I can help you style an outfit.",
            usage=SimpleNamespace(prompt_tokens=11, completion_tokens=7, total_tokens=18),
        )
    )
    result = run_styling_check(_config(), client=client)  # type: ignore[arg-type]
    assert result.ok
    assert result.text == "I can help you style an outfit."
    assert format_usage(result.usage) == "prompt_tokens=11 completion_tokens=7 total_tokens=18"
    sent = client.calls[0]
    assert sent["stream"] is False
    assert sent["max_tokens"] == 512
    assert sent["messages"] == [
        {
            "role": "user",
            "content": "Reply with one short sentence confirming you can help with outfit styling.",
        }
    ]
    assert SECRET not in result.text


def test_empty_and_truncated_responses_fail() -> None:
    empty = run_styling_check(_config(), client=_FakeClient(_completion("  ")))  # type: ignore[arg-type]
    assert not empty.ok
    assert empty.message == EMPTY_MESSAGE

    truncated = run_styling_check(
        _config(),
        client=_FakeClient(_completion("Partial answer", finish_reason="length")),  # type: ignore[arg-type]
    )
    assert not truncated.ok
    assert truncated.text == "Partial answer"
    assert truncated.message == TRUNCATED_MESSAGE


def test_call_errors_do_not_include_the_secret() -> None:
    error = AuthenticationError(
        "Incorrect API key provided: " + SECRET,
        response=_http_response(401),
        body={"api_key": SECRET},
    )
    client = _FakeClient(error=error)
    with pytest.raises(NemotronConfigError) as exc:
        run_styling_check(_config(), client=client)  # type: ignore[arg-type]
    assert exc.value.message == AUTH_MESSAGE
    assert SECRET not in exc.value.message


def test_default_test_setup_cannot_make_a_live_provider_request() -> None:
    from vastra.nemotron import build_client, config_from_settings

    config = config_from_settings(get_settings())
    with pytest.raises(AssertionError, match="not allowed in tests"):
        build_client(config)
    with pytest.raises(AssertionError, match="not allowed in tests"):
        request_chat_completion(config, [{"role": "user", "content": "hello"}], max_tokens=8)
    source = Path(__file__).resolve().parents[1] / "vastra" / "nemotron.py"
    assert "max_retries=0" in source.read_text(encoding="utf-8")


def test_settings_start_without_a_nebius_key(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env").write_text("SECRET_KEY=test-only-secret-key-not-for-production-use\n", encoding="utf-8")
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    monkeypatch.delenv("STYLIST_MODEL", raising=False)
    monkeypatch.delenv("NEMOTRON_MODEL", raising=False)
    clear_settings_cache()
    settings = get_settings()
    assert settings.nebius_api_key is None
    assert settings.nemotron_model == "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
    assert settings.stylist_model == "nvidia/nemotron-3-super-120b-a12b"
    assert settings.nemotron_timeout_seconds == 60
    clear_settings_cache()


def test_reasoning_token_count_is_read_and_request_parameters_stay_unchanged() -> None:
    usage = SimpleNamespace(
        prompt_tokens=559,
        completion_tokens=1024,
        total_tokens=1583,
        completion_tokens_details=SimpleNamespace(reasoning_tokens=900, reasoning_content="private trace"),
    )
    client = _FakeClient(_completion("not logged", finish_reason="length", usage=usage))
    result = request_chat_completion(
        _config(),
        [{"role": "user", "content": "private prompt"}],
        max_tokens=2048,
        client=client,  # type: ignore[arg-type]
    )
    assert result.reasoning_tokens == 900
    assert result.prompt_tokens == 559
    assert result.completion_tokens == 1024
    assert result.finish_reason == "length"
    assert result.truncated
    sent = client.calls[0]
    assert set(sent) == {"model", "messages", "max_tokens", "stream", "extra_body"}
    assert sent["max_tokens"] == 2048
    assert sent["stream"] is False
    assert sent["extra_body"] == NEMOTRON_REQUEST_EXTRA
    assert sent["extra_body"] == {"chat_template_kwargs": {"enable_thinking": False}}
    assert "reasoning_effort" not in sent
    assert "response_format" not in sent
    assert len(client.calls) == 1
    printed = format_usage(
        TokenUsage(
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            total_tokens=result.total_tokens,
            reasoning_tokens=result.reasoning_tokens,
        )
    )
    assert printed == "prompt_tokens=559 completion_tokens=1024 total_tokens=1583 reasoning_tokens=900"
    assert "private trace" not in printed
    assert "private prompt" not in printed

    missing = request_chat_completion(
        _config(),
        [{"role": "user", "content": "private prompt"}],
        max_tokens=2048,
        client=_FakeClient(  # type: ignore[arg-type]
            _completion(
                "answer",
                usage=SimpleNamespace(
                    prompt_tokens=1,
                    completion_tokens=2,
                    total_tokens=3,
                    completion_tokens_details=SimpleNamespace(reasoning_tokens="not-a-count"),
                ),
            )
        ),
    )
    assert missing.reasoning_tokens is None


def test_smoke_script_exits_nonzero_without_calling_the_api(monkeypatch: pytest.MonkeyPatch) -> None:
    import scripts.check_nemotron as script

    monkeypatch.setattr(script, "load_dotenv", lambda _path: None)

    def missing_key() -> NemotronConfig:
        raise NemotronConfigError(MISSING_KEY_MESSAGE)

    monkeypatch.setattr(script, "parse_nemotron_env", missing_key)

    def fail_if_called(_config: NemotronConfig) -> None:
        raise AssertionError("network client should not be created")

    monkeypatch.setattr(script, "run_styling_check", fail_if_called)
    assert script.main() == 1
