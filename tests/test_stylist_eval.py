"""The evaluation script stays offline unless --run is passed."""

import json

import pytest

from scripts.evaluate_stylist_models import (
    EVALUATION_VERSION,
    EVALUATION_VERSION_NOTE,
    completion_kwargs,
    grade_reply,
    load_settings,
    main,
    messages_for,
    scenarios,
    FROZEN_PROMPT,
)
from vastra.nemotron import NEMOTRON_REQUEST_EXTRA
from vastra.stylist import STYLIST_MAX_OUTPUT_TOKENS, stylist_instructions


def test_preview_does_not_call_the_provider(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    def fail_if_called(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("provider client should not be created")

    monkeypatch.setattr("scripts.evaluate_stylist_models.build_client", fail_if_called)
    monkeypatch.setattr("scripts.evaluate_stylist_models.parse_nemotron_env", fail_if_called)
    assert main([]) == 0
    printed = capsys.readouterr().out
    assert "No model request is sent unless you pass --run." in printed
    assert "Evaluation version 8" in printed
    assert EVALUATION_VERSION == 8
    assert "Version 1" in EVALUATION_VERSION_NOTE
    assert "No request for database IDs" in printed
    assert "owned cream trousers" in printed.casefold()
    assert "No wardrobe and no profile" in printed
    assert "Follow-up corrects" in printed
    assert "saved garment is unavailable" in printed.casefold()
    assert "Two saved garments share a name" in printed


def test_scenario_selector_preview_stays_offline(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--scenario", "owned_uncatalogued"]) == 0
    printed = capsys.readouterr().out
    assert "owned_uncatalogued:" in printed
    assert "No wardrobe and no profile" not in printed
    assert "stylist_super_diagnostic.settings.json" in printed


def test_unknown_scenario_sends_nothing(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    def fail_if_called(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("provider client should not be created")

    monkeypatch.setattr("scripts.evaluate_stylist_models.build_client", fail_if_called)
    monkeypatch.setattr("scripts.evaluate_stylist_models.parse_nemotron_env", fail_if_called)
    assert main(["--run", "--model", "nvidia/nemotron-3-super-120b-a12b", "--scenario", "missing"]) == 2
    assert "No request was sent." in capsys.readouterr().err


def test_super_diagnostic_settings_shape_one_completion(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    from types import SimpleNamespace

    from vastra.nemotron import NemotronConfig

    calls: list[dict[str, object]] = []

    class Completions:
        def create(self, **kwargs: object) -> object:
            calls.append(kwargs)
            usage = SimpleNamespace(
                prompt_tokens=10,
                completion_tokens=20,
                total_tokens=30,
                completion_tokens_details=SimpleNamespace(reasoning_tokens=0),
            )
            message = SimpleNamespace(content='{"kind":"clarification","text":"Which occasion?","outfit":null}')
            return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="stop")], usage=usage)

    client = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
    monkeypatch.setattr("scripts.evaluate_stylist_models.build_client", lambda _config: client)
    monkeypatch.setattr(
        "scripts.evaluate_stylist_models.parse_nemotron_env",
        lambda: NemotronConfig(api_key="test-key", base_url="https://example.invalid/v1/", model="other", timeout_seconds=60),
    )
    code = main(
        [
            "--run",
            "--model",
            "nvidia/nemotron-3-super-120b-a12b",
            "--scenario",
            "owned_uncatalogued",
            "--settings",
            "scripts/stylist_super_diagnostic.settings.json",
        ]
    )
    assert code == 0
    assert len(calls) == 1
    assert calls[0]["model"] == "nvidia/nemotron-3-super-120b-a12b"
    assert calls[0]["max_tokens"] == STYLIST_MAX_OUTPUT_TOKENS
    assert calls[0]["extra_body"] == {"chat_template_kwargs": {"enable_thinking": False}}
    assert calls[0]["messages"][0]["content"] == stylist_instructions()
    record = json.loads(capsys.readouterr().out)
    assert record["scenario"] == "owned_uncatalogued"
    assert record["reasoning_tokens"] == 0
    assert record["schema_success"] is True
    assert record["experimental_note"].startswith("Experimental.")
    assert "Nebius" in record["experimental_note"]


def test_comparison_settings_leave_super_without_a_thinking_override() -> None:
    from pathlib import Path

    comparison = load_settings(Path("scripts/stylist_eval_settings.example.json"))
    diagnostic = load_settings(Path("scripts/stylist_super_diagnostic.settings.json"))
    assert comparison["nvidia/nemotron-3-super-120b-a12b"].extra_body is None
    assert comparison["nvidia/nemotron-3-super-120b-a12b"].experimental_note is None
    assert diagnostic["nvidia/nemotron-3-super-120b-a12b"].extra_body == {
        "chat_template_kwargs": {"enable_thinking": False}
    }


def test_run_without_a_model_sends_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_if_called(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("provider client should not be created")

    monkeypatch.setattr("scripts.evaluate_stylist_models.build_client", fail_if_called)
    assert main(["--run"]) == 2


def test_every_scenario_uses_the_same_prompt_and_schema_budget() -> None:
    prompts = {messages_for(scenario)[0]["content"] for scenario in scenarios()}
    assert prompts == {stylist_instructions()}
    assert FROZEN_PROMPT.read_text(encoding="utf-8") == stylist_instructions()
    assert all(completion_kwargs("other-model", [], _settings())["max_tokens"] == STYLIST_MAX_OUTPUT_TOKENS for _settings in [_empty])


def _empty() -> object:
    from scripts.evaluate_stylist_models import ModelSettings

    return ModelSettings()


def test_unconfigured_model_does_not_inherit_nano_thinking_controls() -> None:
    from scripts.evaluate_stylist_models import ModelSettings

    kwargs = completion_kwargs("nvidia/nemotron-3-super-120b-a12b", [{"role": "user", "content": "data"}], ModelSettings())
    assert "extra_body" not in kwargs
    assert NEMOTRON_REQUEST_EXTRA["chat_template_kwargs"] not in kwargs.values()
    nano = completion_kwargs(
        "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
        [],
        ModelSettings(extra_body=NEMOTRON_REQUEST_EXTRA),
    )
    assert nano["extra_body"] == NEMOTRON_REQUEST_EXTRA


def test_settings_reject_unknown_sampling(tmp_path: object) -> None:
    from pathlib import Path

    path = Path(str(tmp_path)) / "settings.json"
    path.write_text(json.dumps({"some-model": {"sampling": {"enable_thinking": False}}}), encoding="utf-8")
    with pytest.raises(Exception, match="Unsupported sampling parameter"):
        load_settings(path)


def test_fixtures_match_the_five_cases() -> None:
    by_key = {scenario.key: scenario for scenario in scenarios()}
    owned = by_key["owned_uncatalogued"]
    assert owned.profile is not None
    assert [item.name for item in owned.available] == ["Ivory buttoned shirt"]
    assert "cream trousers" in owned.body.message
    assert by_key["empty_context"].profile is None
    assert by_key["empty_context"].available == []
    correction = by_key["follow_up_correction"]
    assert correction.body.history[1].role == "assistant"
    assert "navy kurta" in correction.body.history[1].content
    assert "ivory shirt" in correction.body.message.casefold()
    unavailable = by_key["saved_unavailable"]
    assert "indigo kurta" not in [item.name.casefold() for item in unavailable.available]
    assert [item.availability for item in unavailable.unavailable] == ["in_laundry"]
    assert "in_laundry" in unavailable.scorer_note
    payload = json.loads(messages_for(unavailable)[1]["content"].split("\n", 1)[1])
    assert payload["unavailable_wardrobe"][0]["name"] == "Indigo kurta"
    assert payload["unavailable_wardrobe"][0]["availability"] == "in_laundry"
    assert payload["available_wardrobe"][0]["name"] == "Ivory buttoned shirt"
    duplicates = by_key["duplicate_names"].available
    assert [item.name for item in duplicates] == ["White shirt", "White shirt"]
    assert [item.id for item in duplicates] == ["fixture-shirt-linen", "fixture-shirt-cotton"]
    assert {item.notes for item in duplicates} == {"linen", "cotton"}


def test_schema_grade_rejects_bad_provenance_without_copying_the_reply() -> None:
    scenario = next(item for item in scenarios() if item.key == "owned_uncatalogued")
    old_contract = {
        "kind": "proposal",
        "message": "The trousers are unavailable.",
        "suggestions": [
            {
                "title": "Dinner",
                "note": "Preferred with flats",
                "pieces": [
                    {
                        "source": "described",
                        "name": "Cream trousers",
                        "category": "bottom",
                        "color": "cream",
                        "note": "Preferred with flats",
                        "user_quote": "I own cream trousers and prefer flats",
                    }
                ],
            }
        ],
    }
    graded = grade_reply(scenario, json.dumps(old_contract), False, "stop")
    assert graded["schema_success"] is False
    assert graded["error_reason"] == "schema_validation"
    assert graded["reply"] is None
    assert "Preferred" not in graded["error_reason"]

    phrase = {
        "kind": "proposal",
        "text": "Shirt with the trousers the user described.",
        "outfit": {
            "pieces": [
                {"source": "saved_wardrobe", "wardrobe_item_id": "fixture-ivory-shirt"},
                {"source": "described", "user_turn": 0, "garment_phrase": "cream trousers", "category": "bottom"},
            ]
        },
    }
    same_name = grade_reply(scenario, json.dumps(phrase), False, "stop")
    assert same_name["schema_success"] is True
    piece = same_name["reply"]["suggestions"][0]["pieces"][1]
    assert piece["source"] == "described"
    assert piece["wardrobe_item_id"] is None
    assert piece["name"] == "cream trousers"
    assert piece["color"] is None
    assert piece["notes"] == ""

    laundry = next(item for item in scenarios() if item.key == "saved_unavailable")
    selected = {
        "kind": "proposal",
        "text": "Use the saved kurta.",
        "outfit": {
            "pieces": [
                {"source": "saved_wardrobe", "wardrobe_item_id": "fixture-indigo-kurta"}
            ]
        },
    }
    blocked = grade_reply(laundry, json.dumps(selected), False, "stop")
    assert blocked["schema_success"] is False
    assert blocked["error_reason"] == "unavailable_item_id"
