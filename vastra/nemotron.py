"""Optional Nebius Nemotron client. Does not read the database or user records."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    OpenAI,
    RateLimitError,
)

DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1/"
DEFAULT_MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
DEFAULT_TIMEOUT_SECONDS = 60
STYLING_CHECK_PROMPT = (
    "Reply with one short sentence confirming you can help with outfit styling."
)
MAX_OUTPUT_TOKENS = 512

MISSING_KEY_MESSAGE = "NEBIUS_API_KEY is missing. Set it in the backend .env file."
MISSING_BASE_URL_MESSAGE = "NEBIUS_BASE_URL is missing."
MISSING_MODEL_MESSAGE = "NEMOTRON_MODEL is missing."
INVALID_TIMEOUT_MESSAGE = "NEMOTRON_TIMEOUT_SECONDS must be a positive number of seconds."
INVALID_BASE_URL_MESSAGE = "NEBIUS_BASE_URL must be an http or https URL."
AUTH_MESSAGE = "Authentication failed. Check NEBIUS_API_KEY."
RATE_LIMIT_MESSAGE = "The model service rate-limited the request. Try again later."
TIMEOUT_MESSAGE = "The model request timed out."
CONNECTION_MESSAGE = "Could not connect to the model service."
EMPTY_MESSAGE = "The model returned an empty response."
TRUNCATED_MESSAGE = "The model response was truncated."
FAILED_MESSAGE = "The model request failed."


class NemotronConfigError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NemotronCallError(Exception):
    """Provider failure with a sanitized message. kind is timeout, rate_limit, or unavailable."""

    def __init__(self, message: str, kind: str) -> None:
        super().__init__(message)
        self.message = message
        self.kind = kind


@dataclass(frozen=True)
class ChatResult:
    text: str
    truncated: bool
    finish_reason: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


@dataclass(frozen=True)
class NemotronConfig:
    api_key: str
    base_url: str
    model: str
    timeout_seconds: float


@dataclass(frozen=True)
class TokenUsage:
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None


@dataclass(frozen=True)
class SmokeResult:
    ok: bool
    text: str
    message: str | None
    usage: TokenUsage | None


def parse_nemotron_env(environ: Mapping[str, str] | None = None) -> NemotronConfig:
    """Validate model settings. Raises before any network call."""
    source = os.environ if environ is None else environ
    key = _optional_text(source.get("NEBIUS_API_KEY"))
    base_url = _optional_text(source.get("NEBIUS_BASE_URL")) or DEFAULT_BASE_URL
    model = _optional_text(source.get("NEMOTRON_MODEL")) or DEFAULT_MODEL
    timeout = _timeout_seconds(source.get("NEMOTRON_TIMEOUT_SECONDS"))

    if key is None:
        raise NemotronConfigError(MISSING_KEY_MESSAGE)
    if not base_url:
        raise NemotronConfigError(MISSING_BASE_URL_MESSAGE)
    if not (base_url.startswith("https://") or base_url.startswith("http://")):
        raise NemotronConfigError(INVALID_BASE_URL_MESSAGE)
    if not model:
        raise NemotronConfigError(MISSING_MODEL_MESSAGE)
    if timeout is None:
        raise NemotronConfigError(INVALID_TIMEOUT_MESSAGE)

    return NemotronConfig(
        api_key=key,
        base_url=base_url,
        model=model,
        timeout_seconds=timeout,
    )


def public_call_error(exc: Exception) -> str:
    """Map provider errors to text that does not include secrets or response bodies."""
    status = getattr(exc, "status_code", None)
    if isinstance(exc, AuthenticationError) or status == 401:
        return AUTH_MESSAGE
    if isinstance(exc, RateLimitError) or status == 429:
        return RATE_LIMIT_MESSAGE
    if isinstance(exc, APITimeoutError):
        return TIMEOUT_MESSAGE
    if isinstance(exc, APIConnectionError):
        return CONNECTION_MESSAGE
    if isinstance(exc, APIStatusError):
        return FAILED_MESSAGE
    return FAILED_MESSAGE


def config_from_settings(settings: object) -> NemotronConfig:
    """Build a client config from application settings. Does not contact the provider."""
    key = _optional_text(getattr(settings, "nebius_api_key", None))
    base_url = _optional_text(getattr(settings, "nebius_base_url", None)) or DEFAULT_BASE_URL
    model = _optional_text(getattr(settings, "nemotron_model", None)) or DEFAULT_MODEL
    raw_timeout = getattr(settings, "nemotron_timeout_seconds", DEFAULT_TIMEOUT_SECONDS)
    timeout = _timeout_seconds(None if raw_timeout is None else str(raw_timeout))
    if key is None:
        raise NemotronConfigError(MISSING_KEY_MESSAGE)
    if not (base_url.startswith("https://") or base_url.startswith("http://")):
        raise NemotronConfigError(INVALID_BASE_URL_MESSAGE)
    if not model:
        raise NemotronConfigError(MISSING_MODEL_MESSAGE)
    if timeout is None:
        raise NemotronConfigError(INVALID_TIMEOUT_MESSAGE)
    return NemotronConfig(
        api_key=key,
        base_url=base_url,
        model=model,
        timeout_seconds=timeout,
    )


def build_client(config: NemotronConfig) -> OpenAI:
    return OpenAI(
        api_key=config.api_key,
        base_url=config.base_url,
        timeout=config.timeout_seconds,
        max_retries=0,
    )


def call_error_kind(exc: Exception) -> str:
    status = getattr(exc, "status_code", None)
    if isinstance(exc, APITimeoutError):
        return "timeout"
    if isinstance(exc, RateLimitError) or status == 429:
        return "rate_limit"
    return "unavailable"


def request_chat_completion(
    config: NemotronConfig,
    messages: list[dict[str, str]],
    *,
    max_tokens: int,
    client: OpenAI | None = None,
) -> ChatResult:
    """One non-streaming completion. Retries are disabled. Raises NemotronCallError on provider failure."""
    openai_client = client or build_client(config)
    try:
        response = openai_client.chat.completions.create(
            model=config.model,
            messages=messages,
            max_tokens=max_tokens,
            stream=False,
        )
    except Exception as exc:
        raise NemotronCallError(public_call_error(exc), call_error_kind(exc)) from None

    choice = response.choices[0] if response.choices else None
    content = ""
    finish_reason = None
    if choice is not None and choice.message is not None and choice.message.content:
        content = choice.message.content.strip()
    if choice is not None:
        finish_reason = choice.finish_reason
    usage = _usage(getattr(response, "usage", None))
    return ChatResult(
        text=content,
        truncated=finish_reason == "length",
        finish_reason=finish_reason if isinstance(finish_reason, str) else None,
        prompt_tokens=None if usage is None else usage.prompt_tokens,
        completion_tokens=None if usage is None else usage.completion_tokens,
        total_tokens=None if usage is None else usage.total_tokens,
    )


def run_styling_check(config: NemotronConfig, client: OpenAI | None = None) -> SmokeResult:
    """One non-streaming completion. The caller supplies config; this sends no user data."""
    openai_client = client or build_client(config)
    try:
        response = openai_client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": STYLING_CHECK_PROMPT}],
            max_tokens=MAX_OUTPUT_TOKENS,
            stream=False,
        )
    except Exception as exc:
        raise NemotronConfigError(public_call_error(exc)) from None

    choice = response.choices[0] if response.choices else None
    content = ""
    finish_reason = None
    if choice is not None and choice.message is not None and choice.message.content:
        content = choice.message.content.strip()
    if choice is not None:
        finish_reason = choice.finish_reason

    usage = _usage(getattr(response, "usage", None))
    if not content:
        return SmokeResult(ok=False, text="", message=EMPTY_MESSAGE, usage=usage)
    if finish_reason == "length":
        return SmokeResult(ok=False, text=content, message=TRUNCATED_MESSAGE, usage=usage)
    return SmokeResult(ok=True, text=content, message=None, usage=usage)


def format_usage(usage: TokenUsage | None) -> str | None:
    if usage is None:
        return None
    parts: list[str] = []
    if usage.prompt_tokens is not None:
        parts.append(f"prompt_tokens={usage.prompt_tokens}")
    if usage.completion_tokens is not None:
        parts.append(f"completion_tokens={usage.completion_tokens}")
    if usage.total_tokens is not None:
        parts.append(f"total_tokens={usage.total_tokens}")
    if not parts:
        return None
    return " ".join(parts)


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _timeout_seconds(value: str | None) -> float | None:
    if value is None or not value.strip():
        return float(DEFAULT_TIMEOUT_SECONDS)
    try:
        timeout = float(value.strip())
    except ValueError:
        return None
    if timeout <= 0 or timeout == float("inf"):
        return None
    return timeout


def _usage(usage: object) -> TokenUsage | None:
    if usage is None:
        return None
    return TokenUsage(
        prompt_tokens=_int_or_none(getattr(usage, "prompt_tokens", None)),
        completion_tokens=_int_or_none(getattr(usage, "completion_tokens", None)),
        total_tokens=_int_or_none(getattr(usage, "total_tokens", None)),
    )


def _int_or_none(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value

