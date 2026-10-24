"""Manual comparison of Stylist replies across Nemotron models.

The same fixtures, prompt, and schema are used for every model. This script
does not contact Nebius unless you pass --run. Pytest does not pass --run.

Model-specific settings are whatever you put in --settings. Nano's thinking
control is not applied to any model automatically.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

from vastra.models import StyleProfile, WardrobeItem
from vastra.nemotron import (
    NemotronCallError,
    NemotronConfig,
    NemotronConfigError,
    build_client,
    parse_nemotron_env,
    public_call_error,
)
from vastra.schemas import StylistChatRequest, StylistChatResponse, StylistHistoryMessage
from vastra.stylist import (
    STYLIST_MAX_OUTPUT_TOKENS,
    StylistRequestError,
    _parse_reply,
    _public_message,
    _resolve_outfit,
    _user_statements,
    build_stylist_messages,
    stylist_instructions,
)

EVALUATION_VERSION = 8
EVALUATION_VERSION_NOTE = (
    "Evaluation version 8 tells the model to use a saved wardrobe id when the user "
    "clearly identifies an available saved garment, and to ask when that reference is ambiguous. "
    "Version 7 includes confirmed preferences as guidance. "
    "They do not change ownership or availability. "
    "Version 6 tells the model to acknowledge an unavailable saved garment, "
    "to put every recommended garment in the pieces, and to suggest unowned shoes. "
    "A shirt with trousers is not fusion by itself. "
    "Version 5 tells a proposal to select one bottom or one one-piece. "
    "Requested trousers are that bottom, and a saved bottom is left out. "
    "Version 4 accepts an optional category on a saved_wardrobe reference and ignores it. "
    "The prompt still requests the minimal saved shape from version 3. "
    "Version 3 added one JSON example for each piece type. "
    "Version 2 used that contract before those examples. "
    "Version 1 used model-written titles, quotes, and copied wardrobe fields."
)

SAMPLING_PARAMETERS = (
    "temperature",
    "top_p",
    "top_k",
    "repetition_penalty",
    "frequency_penalty",
    "presence_penalty",
)
CHECKLIST = (
    "Manual scoring checklist, one pass per scenario and model:",
    "- No request for database IDs from the user.",
    "- Uses facts already supplied.",
    "- Correct ownership and source labels.",
    "- Coherent outfit and a relevant explanation.",
    "- No invented availability or fabric properties.",
    "Schema success is recorded automatically. The checklist is still a human score.",
)


FROZEN_PROMPT = ROOT / "scripts" / "stylist_comparison_prompt.txt"


@dataclass(frozen=True)
class Scenario:
    key: str
    title: str
    scorer_note: str
    body: StylistChatRequest
    profile: StyleProfile | None
    available: list[WardrobeItem]
    unavailable: list[WardrobeItem]


@dataclass(frozen=True)
class ModelSettings:
    extra_body: dict[str, Any] | None = None
    sampling: dict[str, Any] | None = None
    experimental_note: str | None = None


class _FixtureLookup:
    """Resolve only the fixture's unavailable rows. The evaluation does not open the app database."""

    def __init__(self, rows: list[WardrobeItem]) -> None:
        self.rows = {row.id: row for row in rows}

    def scalar(self, statement: object) -> WardrobeItem | None:
        compile_sql = getattr(statement, "compile", None)
        if not callable(compile_sql):
            return None
        params = getattr(compile_sql(), "params", {}) or {}
        for value in params.values():
            if isinstance(value, str) and value in self.rows:
                return self.rows[value]
        return None


def scenarios() -> list[Scenario]:
    """Synthetic fixtures. They are not loaded from the database or from a user account."""
    shirt = _item("fixture-ivory-shirt", "Ivory buttoned shirt", "top", "ivory", "cotton")
    kurta = _item("fixture-navy-kurta", "Navy kurta", "top", "navy", "")
    linen = _item("fixture-shirt-linen", "White shirt", "top", "white", "linen")
    cotton = _item("fixture-shirt-cotton", "White shirt", "top", "white", "cotton")
    profile = _profile()
    dinner = "Dinner tonight. I want fusion. I own cream trousers and prefer flats."
    return [
        Scenario(
            key="owned_uncatalogued",
            title="Owned cream trousers are not in the saved wardrobe",
            scorer_note=(
                "The user says they own cream trousers and prefer flats for a fusion dinner. "
                "The trousers are not a saved row. The ivory shirt is the only saved available garment."
            ),
            body=StylistChatRequest(message=dinner),
            profile=profile,
            available=[shirt],
            unavailable=[],
        ),
        Scenario(
            key="empty_context",
            title="No wardrobe and no profile",
            scorer_note="saved_profile is null. available_wardrobe and unavailable_wardrobe are empty.",
            body=StylistChatRequest(message="I need an outfit for a daytime meeting."),
            profile=None,
            available=[],
            unavailable=[],
        ),
        Scenario(
            key="follow_up_correction",
            title="Follow-up corrects a previous garment choice",
            scorer_note=(
                "An earlier assistant turn suggested the navy kurta. "
                "The latest user turn says not to use it and to use the ivory shirt. "
                "The assistant turn is not ownership evidence."
            ),
            body=StylistChatRequest(
                message="Do not use the navy kurta. Use the ivory shirt instead.",
                history=[
                    StylistHistoryMessage(role="user", content=dinner),
                    StylistHistoryMessage(
                        role="assistant",
                        content="Use the navy kurta with the cream trousers.",
                    ),
                ],
            ),
            profile=profile,
            available=[shirt, kurta],
            unavailable=[],
        ),
        Scenario(
            key="saved_unavailable",
            title="A saved garment is unavailable",
            scorer_note=(
                "Indigo kurta is in unavailable_wardrobe with availability in_laundry. "
                "It must not be selected. Cream trousers are not a saved row."
            ),
            body=StylistChatRequest(
                message="Please style my indigo kurta for dinner. I own cream trousers.",
            ),
            profile=profile,
            available=[shirt],
            unavailable=[_item("fixture-indigo-kurta", "Indigo kurta", "top", "indigo", "", "in_laundry")],
        ),
        Scenario(
            key="duplicate_names",
            title="Two saved garments share a name",
            scorer_note=(
                "Two available rows are both named White shirt. "
                "fixture-shirt-linen has notes linen. fixture-shirt-cotton has notes cotton. "
                "The user asked for the cotton shirt."
            ),
            body=StylistChatRequest(
                message="Wear the cotton white shirt with the cream trousers I own.",
            ),
            profile=profile,
            available=[linen, cotton],
            unavailable=[],
        ),
    ]


def selected_scenarios(keys: list[str]) -> list[Scenario]:
    """Return every scenario, or the named subset. An unknown key stops before any request."""
    available = scenarios()
    if not keys:
        return available
    by_key = {scenario.key: scenario for scenario in available}
    chosen: list[Scenario] = []
    seen: set[str] = set()
    for key in keys:
        if key in seen:
            raise NemotronConfigError(f"Scenario {key} was passed more than once. No request was sent.")
        if key not in by_key:
            known = ", ".join(scenario.key for scenario in available)
            raise NemotronConfigError(f"Unknown scenario {key}. Known scenarios: {known}. No request was sent.")
        seen.add(key)
        chosen.append(by_key[key])
    return chosen


def messages_for(scenario: Scenario) -> list[dict[str, str]]:
    require_frozen_prompt()
    return build_stylist_messages(scenario.body, scenario.profile, scenario.available, scenario.unavailable)


def require_frozen_prompt() -> None:
    """Stop before a paid call if the comparison prompt is no longer the frozen text."""
    if not FROZEN_PROMPT.is_file() or FROZEN_PROMPT.read_text(encoding="utf-8") != stylist_instructions():
        raise NemotronConfigError("The frozen comparison prompt does not match the stylist prompt.")


def completion_kwargs(
    model: str,
    messages: list[dict[str, str]],
    settings: ModelSettings,
) -> dict[str, Any]:
    """Arguments for one completion. extra_body is included only when configured for this model."""
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": STYLIST_MAX_OUTPUT_TOKENS,
        "stream": False,
    }
    if settings.sampling:
        kwargs.update(settings.sampling)
    if settings.extra_body:
        kwargs["extra_body"] = settings.extra_body
    return kwargs


def load_settings(path: Path | None) -> dict[str, ModelSettings]:
    if path is None:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise NemotronConfigError("Settings must be a JSON object keyed by model ID.")
    loaded: dict[str, ModelSettings] = {}
    for model_id, raw in payload.items():
        if not isinstance(model_id, str) or not model_id.strip():
            raise NemotronConfigError("Each settings key must be a model ID.")
        if not isinstance(raw, dict):
            raise NemotronConfigError(f"Settings for {model_id} must be an object.")
        extra = raw.get("extra_body")
        sampling = raw.get("sampling", {})
        note = raw.get("experimental_note")
        unexpected = sorted(set(raw) - {"extra_body", "sampling", "experimental_note"})
        if unexpected:
            raise NemotronConfigError(f"Unsupported settings field for {model_id}: {', '.join(unexpected)}.")
        if extra is not None and not isinstance(extra, dict):
            raise NemotronConfigError(f"extra_body for {model_id} must be an object or null.")
        if not isinstance(sampling, dict):
            raise NemotronConfigError(f"sampling for {model_id} must be an object.")
        if note is not None and not isinstance(note, str):
            raise NemotronConfigError(f"experimental_note for {model_id} must be a string.")
        unknown = sorted(set(sampling) - set(SAMPLING_PARAMETERS))
        if unknown:
            raise NemotronConfigError(
                f"Unsupported sampling parameter for {model_id}: {', '.join(unknown)}."
            )
        loaded[model_id] = ModelSettings(
            extra_body=extra if extra else None,
            sampling=sampling or None,
            experimental_note=note,
        )
    return loaded


def grade_reply(scenario: Scenario, text: str, truncated: bool, finish_reason: str | None) -> dict[str, Any]:
    """Validate with the stylist schema. The reason code is the sanitized result, not the reply text."""
    captured: list[str] = []

    class _Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(record.getMessage())

    handler = _Capture()
    logger = logging.getLogger("vastra.stylist")
    logger.addHandler(handler)
    previous = logger.level
    logger.setLevel(logging.WARNING)
    try:
        chat = _ChatView(text=text, truncated=truncated, finish_reason=finish_reason)
        parsed = _parse_reply(chat)
        suggestions = _resolve_outfit(
            _FixtureLookup(scenario.unavailable),
            "fixture-owner",
            parsed,
            scenario.available,
            _user_statements(scenario.body),
        )
        public = StylistChatResponse(
            kind=parsed.kind,
            message=_public_message(parsed.kind, parsed.text, suggestions),
            suggestions=suggestions,
        )
        return {
            "schema_success": True,
            "error_reason": None,
            "reply": public.model_dump(),
        }
    except StylistRequestError:
        return {
            "schema_success": False,
            "error_reason": _reason_code(captured),
            "reply": None,
        }
    finally:
        logger.removeHandler(handler)
        logger.setLevel(previous)


def preview(chosen: list[Scenario] | None = None) -> str:
    lines = [
        f"Stylist model comparison version {EVALUATION_VERSION}",
        EVALUATION_VERSION_NOTE,
        "No model request is sent unless you pass --run.",
        "Pass --model once for each model. Put that model's own settings in --settings.",
        "If a model has no settings entry, the request omits extra_body and sampling overrides.",
        "Every model receives scripts/stylist_comparison_prompt.txt and the same fixtures.",
        f"max_tokens={STYLIST_MAX_OUTPUT_TOKENS}. One completion per scenario. No retries.",
        "",
        *CHECKLIST,
        "",
        "Scenarios:",
    ]
    shown = scenarios() if chosen is None else chosen
    for index, scenario in enumerate(shown, start=1):
        lines.append(f"{index}. {scenario.key}: {scenario.title}")
        lines.append(f"   {scenario.scorer_note}")
    lines.extend(
        [
            "",
            "Example:",
            "python scripts/evaluate_stylist_models.py --run \\",
            "  --model nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B \\",
            "  --model nvidia/nemotron-3-super-120b-a12b \\",
            "  --settings scripts/stylist_eval_settings.example.json",
            "",
            "Super diagnostic, one scenario, thinking control unconfirmed on Nebius:",
            "python scripts/evaluate_stylist_models.py --run \\",
            "  --model nvidia/nemotron-3-super-120b-a12b \\",
            "  --scenario owned_uncatalogued \\",
            "  --settings scripts/stylist_super_diagnostic.settings.json",
        ]
    )
    return "\n".join(lines)


def run_comparison(
    models: list[str],
    settings: dict[str, ModelSettings],
    config: NemotronConfig,
    chosen: list[Scenario],
) -> list[dict[str, Any]]:
    client = build_client(config)
    records: list[dict[str, Any]] = []
    for model in models:
        model_settings = settings.get(model, ModelSettings())
        model_config = replace(config, model=model)
        for scenario in chosen:
            messages = messages_for(scenario)
            kwargs = completion_kwargs(model, messages, model_settings)
            started = time.perf_counter()
            try:
                response = client.chat.completions.create(**kwargs)
            except Exception as exc:
                records.append(
                    _record(
                        scenario,
                        model_config.model,
                        int((time.perf_counter() - started) * 1000),
                        schema_success=False,
                        error_reason=_provider_reason(exc),
                        experimental_note=model_settings.experimental_note,
                    )
                )
                if _is_auth_failure(exc):
                    return records
                continue
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            choice = response.choices[0] if response.choices else None
            text = ""
            finish_reason = None
            if choice is not None and choice.message is not None and choice.message.content:
                text = choice.message.content.strip()
            if choice is not None and isinstance(choice.finish_reason, str):
                finish_reason = choice.finish_reason
            usage = getattr(response, "usage", None)
            graded = grade_reply(scenario, text, finish_reason == "length", finish_reason)
            records.append(
                _record(
                    scenario,
                    model_config.model,
                    elapsed_ms,
                    schema_success=graded["schema_success"],
                    error_reason=graded["error_reason"],
                    finish_reason=finish_reason,
                    usage=usage,
                    reply=graded["reply"],
                    response_text=text,
                    experimental_note=model_settings.experimental_note,
                )
            )
    return records


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Compare Stylist replies across Nemotron models.")
    parser.add_argument("--run", action="store_true", help="Send the paid evaluation requests.")
    parser.add_argument("--model", action="append", default=[], help="Model ID. Repeat for each model.")
    parser.add_argument("--scenario", action="append", default=[], help="Scenario key. Repeat to select more than one.")
    parser.add_argument("--settings", type=Path, help="JSON object of per-model extra_body and sampling.")
    args = parser.parse_args(argv)
    try:
        chosen = selected_scenarios(args.scenario)
    except NemotronConfigError as exc:
        print(exc.message, file=sys.stderr)
        return 2
    if not args.run:
        try:
            require_frozen_prompt()
        except NemotronConfigError as exc:
            print(exc.message, file=sys.stderr)
            return 1
        print(preview(chosen))
        return 0
    if not args.model:
        print("Pass --model for each model. No request was sent.", file=sys.stderr)
        return 2
    load_dotenv(ROOT / ".env")
    try:
        config = parse_nemotron_env()
        settings = load_settings(args.settings)
    except (NemotronConfigError, json.JSONDecodeError, OSError) as exc:
        message = exc.message if isinstance(exc, NemotronConfigError) else "Could not read the settings file."
        print(message, file=sys.stderr)
        return 1
    records = run_comparison(args.model, settings, config, chosen)
    for record in records:
        print(json.dumps(record, ensure_ascii=True, sort_keys=True))
    return 0


def _item(
    item_id: str,
    name: str,
    category: str,
    color: str,
    notes: str,
    availability: str = "available",
) -> WardrobeItem:
    return WardrobeItem(
        id=item_id,
        owner_id="fixture-owner",
        name=name,
        category=category,
        color=color,
        notes=notes,
        availability=availability,
    )


def _profile() -> StyleProfile:
    return StyleProfile(
        id="fixture-profile",
        owner_id="fixture-owner",
        styling_preference="fusion",
        preferred_styles=["fusion"],
        preferred_colors=["cream"],
        fit_preferences=[],
        comfort_preferences=["prefers flats"],
        clothing_to_avoid=[],
    )


def _record(
    scenario: Scenario,
    model: str,
    latency_ms: int,
    *,
    schema_success: bool,
    error_reason: str | None,
    finish_reason: str | None = None,
    usage: object | None = None,
    reply: dict[str, Any] | None = None,
    response_text: str | None = None,
    experimental_note: str | None = None,
) -> dict[str, Any]:
    return {
        "scenario": scenario.key,
        "model": model,
        "experimental_note": experimental_note,
        "latency_ms": latency_ms,
        "prompt_tokens": _usage_count(usage, "prompt_tokens"),
        "completion_tokens": _usage_count(usage, "completion_tokens"),
        "total_tokens": _usage_count(usage, "total_tokens"),
        "reasoning_tokens": _reasoning_count(usage),
        "finish_reason": finish_reason,
        "schema_success": schema_success,
        "error_reason": error_reason,
        "reply": reply,
        "response_text": response_text,
    }


def _usage_count(usage: object | None, name: str) -> int | None:
    if usage is None:
        return None
    value = getattr(usage, name, None)
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def _reasoning_count(usage: object | None) -> int | None:
    if usage is None:
        return None
    details = getattr(usage, "completion_tokens_details", None)
    if details is None:
        return None
    value = getattr(details, "reasoning_tokens", None)
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def _reason_code(messages: list[str]) -> str:
    for message in messages:
        if not message.startswith("stylist "):
            continue
        for piece in message.split():
            if piece.startswith("result="):
                reason = piece.removeprefix("result=")
                return reason or "invalid_model_result"
    return "invalid_model_result"


def _provider_reason(exc: Exception) -> str:
    if isinstance(exc, NemotronCallError):
        return exc.message
    return public_call_error(exc)


def _is_auth_failure(exc: Exception) -> bool:
    return getattr(exc, "status_code", None) == 401 or public_call_error(exc).startswith("Authentication failed")


@dataclass(frozen=True)
class _ChatView:
    text: str
    truncated: bool
    finish_reason: str | None


if __name__ == "__main__":
    raise SystemExit(main())
