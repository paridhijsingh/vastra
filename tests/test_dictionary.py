"""Style Dictionary API tests. Fixtures are temporary and are not shipped entries."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from vastra.db import get_session_factory
from vastra.dictionary import DictionaryLoadError, load_dictionary, packaged_dictionary_path
from vastra.models import PersonalDictionaryEntry

KURTA = {
    "id": "kurta",
    "term": "Kurta",
    "aliases": ["kurta shirt"],
    "definition": "A tunic-length top worn by people of any gender.",
    "kind": "garment",
    "styles": ["Indian", "fusion"],
    "style_tags": ["Indian", "South Asian"],
    "cultural_context": "Common across South Asia for everyday wear and celebrations.",
    "pairing_suggestions": [
        "One option is straight trousers; other lower garments work too."
    ],
    "occasions": ["everyday", "celebration"],
    "weather_notes": [
        "Lighter cotton is often easier in heat. Comfort still depends on fabric weight, fit, and preference."
    ],
    "comfort_notes": ["A looser cut can feel easier for long wear. Choose the fit you prefer."],
    "guidance_type": "general",
}

BLAZER = {
    "id": "blazer",
    "term": "Blazer",
    "aliases": ["sport coat"],
    "definition": "A tailored jacket that can be worn by people of any gender.",
    "kind": "garment",
    "styles": ["Western"],
    "style_tags": ["Western"],
    "cultural_context": None,
    "pairing_suggestions": ["Often layered over a shirt. That is a suggestion, not a rule."],
    "occasions": ["office"],
    "weather_notes": [],
    "comfort_notes": [],
    "guidance_type": "general",
}

DUPATTA = {
    "id": "dupatta",
    "term": "Dupatta",
    "aliases": ["odhni"],
    "definition": "A long lightweight scarf that can be draped in several ways.",
    "kind": "garment",
    "styles": ["Indian", "fusion"],
    "style_tags": ["Indian", "Yoruba"],
    "cultural_context": None,
    "pairing_suggestions": ["Can be draped with a tunic or other top."],
    "occasions": ["celebration"],
    "weather_notes": [],
    "comfort_notes": ["A lighter weave is often easier to wear for a long time."],
    "guidance_type": "general",
}

A_LINE = {
    "id": "a-line",
    "term": "A-line",
    "aliases": [],
    "definition": "A silhouette that narrows near the top and widens toward the hem.",
    "kind": "silhouette",
    "styles": ["Western", "fusion"],
    "style_tags": ["Western"],
    "cultural_context": None,
    "pairing_suggestions": [],
    "occasions": ["everyday"],
    "weather_notes": [],
    "comfort_notes": [],
    "guidance_type": "general",
}

FIXTURE_ENTRIES = [KURTA, BLAZER, DUPATTA, A_LINE]


def _register_and_login(client: TestClient, username: str) -> dict[str, str]:
    registered = client.post(
        "/auth/register",
        json={"username": username, "password": "securepass1"},
    )
    assert registered.status_code == 201
    login = client.post(
        "/auth/login",
        json={"username": username, "password": "securepass1"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _use_fixture(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    entries: list[dict[str, object]] | None = None,
) -> None:
    path = tmp_path / "dictionary.json"
    path.write_text(json.dumps(entries if entries is not None else FIXTURE_ENTRIES), encoding="utf-8")

    def _path() -> Path:
        return path

    monkeypatch.setattr("vastra.dictionary.packaged_dictionary_path", _path)


def test_packaged_dictionary_is_empty_valid_and_path_is_package_relative(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir(tmp_path)
    path = packaged_dictionary_path()
    package_dir = Path(__file__).resolve().parents[1] / "vastra"
    assert path == package_dir / "dictionary.json"
    assert path.is_file()

    entries = load_dictionary()
    assert entries == []
    ids = [entry.id for entry in entries]
    assert len(ids) == len(set(ids))


def test_fixture_entries_match_schema_and_reject_duplicate_ids(tmp_path: Path) -> None:
    path = tmp_path / "dictionary.json"
    path.write_text(json.dumps(FIXTURE_ENTRIES), encoding="utf-8")
    loaded = load_dictionary(path)
    assert [entry.id for entry in loaded] == ["a-line", "blazer", "dupatta", "kurta"]
    assert loaded[0].style_tags == ["Western"]
    yoruba = next(entry for entry in loaded if entry.id == "dupatta")
    assert "Yoruba" in yoruba.style_tags

    path.write_text(json.dumps([KURTA, KURTA]), encoding="utf-8")
    with pytest.raises(DictionaryLoadError, match="Duplicate dictionary id"):
        load_dictionary(path)


def test_dictionary_requires_authentication(client: TestClient) -> None:
    assert client.get("/dictionary").status_code == 401
    assert client.get("/dictionary/kurta").status_code == 401
    invalid = {"Authorization": "Bearer not-a-real-token"}
    assert client.get("/dictionary", headers=invalid).status_code == 401
    assert client.get("/dictionary/kurta", headers=invalid).status_code == 401


def test_empty_dictionary_returns_empty_list(client: TestClient) -> None:
    headers = _register_and_login(client, "dictempty")
    listed = client.get("/dictionary", headers=headers)
    assert listed.status_code == 200
    assert listed.json() == []
    missing = client.get("/dictionary/kurta", headers=headers)
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Dictionary entry not found"


def test_list_detail_search_and_filters(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _use_fixture(monkeypatch, tmp_path)
    headers = _register_and_login(client, "dictreader")

    listed = client.get("/dictionary", headers=headers)
    assert listed.status_code == 200
    assert [entry["id"] for entry in listed.json()] == ["a-line", "blazer", "dupatta", "kurta"]
    assert listed.json()[3]["guidance_type"] == "general"
    assert "owner_id" not in listed.json()[0]

    detail = client.get("/dictionary/kurta", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["term"] == "Kurta"
    assert detail.json()["styles"] == ["Indian", "fusion"]
    assert detail.json()["cultural_context"].startswith("Common across South Asia")

    unknown = client.get("/dictionary/not-a-term", headers=headers)
    assert unknown.status_code == 404
    assert unknown.json()["detail"] == "Dictionary entry not found"

    by_alias = client.get("/dictionary", headers=headers, params={"q": "  ODHNI  "})
    assert by_alias.status_code == 200
    assert [entry["id"] for entry in by_alias.json()] == ["dupatta"]

    by_definition = client.get("/dictionary", headers=headers, params={"q": "TUNIC-LENGTH"})
    assert [entry["id"] for entry in by_definition.json()] == ["kurta"]

    blank_query = client.get("/dictionary", headers=headers, params={"q": "   "})
    assert len(blank_query.json()) == 4

    combined = client.get(
        "/dictionary",
        headers=headers,
        params={"style": "Indian", "kind": "garment"},
    )
    assert [entry["id"] for entry in combined.json()] == ["dupatta", "kurta"]

    narrowed = client.get(
        "/dictionary",
        headers=headers,
        params={"q": "kurta", "style": "Western", "kind": "garment"},
    )
    assert narrowed.json() == []

    no_match = client.get("/dictionary", headers=headers, params={"q": "not-in-the-catalog"})
    assert no_match.json() == []


def test_tag_filter_matches_style_tags(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _use_fixture(monkeypatch, tmp_path)
    headers = _register_and_login(client, "dicttag")

    assert client.get("/dictionary", params={"tag": "Yoruba"}).status_code == 401

    exact = client.get("/dictionary", headers=headers, params={"tag": "  yOrUbA  "})
    assert exact.status_code == 200
    assert [entry["id"] for entry in exact.json()] == ["dupatta"]

    spaced = client.get("/dictionary", headers=headers, params={"tag": "south asian"})
    assert [entry["id"] for entry in spaced.json()] == ["kurta"]

    blank = client.get("/dictionary", headers=headers, params={"tag": "   "})
    assert len(blank.json()) == 4

    unknown = client.get("/dictionary", headers=headers, params={"tag": "not-a-tag"})
    assert unknown.status_code == 200
    assert unknown.json() == []

    combined = client.get(
        "/dictionary",
        headers=headers,
        params={"tag": "Yoruba", "style": "Indian", "kind": "garment", "q": "dupatta"},
    )
    assert [entry["id"] for entry in combined.json()] == ["dupatta"]

    blocked = client.get(
        "/dictionary",
        headers=headers,
        params={"tag": "Yoruba", "style": "Western"},
    )
    assert blocked.status_code == 200
    assert blocked.json() == []

    partial = client.get("/dictionary", headers=headers, params={"tag": "south"})
    assert partial.json() == []


def test_invalid_dictionary_filters_are_sanitized_422(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _use_fixture(monkeypatch, tmp_path)
    headers = _register_and_login(client, "dictfilter")

    bad_style = client.get("/dictionary", headers=headers, params={"style": "Yoruba"})
    assert bad_style.status_code == 422
    assert any(
        isinstance(err, dict) and "style" in err.get("loc", [])
        for err in bad_style.json()["detail"]
    )
    assert "Yoruba" not in bad_style.text
    for err in bad_style.json()["detail"]:
        assert "input" not in err
        assert "ctx" not in err

    bad_kind = client.get("/dictionary", headers=headers, params={"kind": "dress"})
    assert bad_kind.status_code == 422
    assert any(
        isinstance(err, dict) and "kind" in err.get("loc", [])
        for err in bad_kind.json()["detail"]
    )
    assert "dress" not in bad_kind.text
    for err in bad_kind.json()["detail"]:
        assert "input" not in err
        assert "ctx" not in err


def test_dictionary_does_not_touch_profile_or_wardrobe(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _use_fixture(monkeypatch, tmp_path)
    headers = _register_and_login(client, "dictisolated")
    assert client.get("/dictionary", headers=headers).status_code == 200
    assert client.get("/dictionary/kurta", headers=headers).status_code == 200
    assert client.get("/profile", headers=headers).status_code == 404
    assert client.get("/wardrobe", headers=headers).json() == []

    rejected = client.put(
        "/profile",
        headers=headers,
        json={
            "styling_preference": "unisex",
            "preferred_styles": ["Yoruba"],
            "preferred_colors": [],
            "fit_preferences": [],
            "comfort_preferences": [],
            "clothing_to_avoid": [],
        },
    )
    assert rejected.status_code == 422


PERSONAL_ENTRY = {
    "term": "  Agbada  ",
    "aliases": ["grand boubou"],
    "definition": " A flowing robe worn by people of any gender. ",
    "kind": "garment",
    "styles": ["fusion"],
    "style_tags": ["Yoruba", "West African"],
    "cultural_context": " Worn in parts of West Africa. ",
    "pairing_suggestions": ["One option is a fitted cap."],
    "occasions": ["celebration"],
    "weather_notes": ["A lighter cloth is often easier in heat."],
    "comfort_notes": ["Choose the weight you prefer."],
}


def test_personal_dictionary_entry_crud_and_persistence(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _use_fixture(monkeypatch, tmp_path)
    headers = _register_and_login(client, "dictowner")

    created = client.post("/dictionary", headers=headers, json=PERSONAL_ENTRY)
    assert created.status_code == 201
    body = created.json()
    assert body["origin"] == "personal"
    assert body["id"].startswith("personal-")
    assert body["term"] == "Agbada"
    assert body["definition"] == "A flowing robe worn by people of any gender."
    assert body["cultural_context"] == "Worn in parts of West Africa."
    assert body["guidance_type"] == "general"
    assert body["style_tags"] == ["Yoruba", "West African"]
    assert "owner_id" not in body
    entry_id = body["id"]

    listed = client.get("/dictionary", headers=headers)
    ids = [entry["id"] for entry in listed.json()]
    assert entry_id in ids
    assert "kurta" in ids
    assert listed.json()[ids.index(entry_id)]["origin"] == "personal"
    assert listed.json()[ids.index("kurta")]["origin"] == "shared"

    fetched = client.get(f"/dictionary/{entry_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["aliases"] == ["grand boubou"]

    patched = client.patch(
        f"/dictionary/{entry_id}",
        headers=headers,
        json={"term": "Agbada robe", "cultural_context": None, "aliases": []},
    )
    assert patched.status_code == 200
    assert patched.json()["term"] == "Agbada robe"
    assert patched.json()["cultural_context"] is None
    assert patched.json()["aliases"] == []
    assert patched.json()["style_tags"] == ["Yoruba", "West African"]
    assert patched.json()["definition"].startswith("A flowing robe")

    filtered = client.get(
        "/dictionary",
        headers=headers,
        params={"tag": " west african ", "style": "fusion", "kind": "garment", "q": "robe"},
    )
    assert [entry["id"] for entry in filtered.json()] == [entry_id]

    session = get_session_factory()()
    try:
        row = session.scalar(select(PersonalDictionaryEntry).where(PersonalDictionaryEntry.id == entry_id))
        assert row is not None
        assert row.term == "Agbada robe"
        assert row.aliases == []
        assert row.cultural_context is None
        assert row.owner_id
    finally:
        session.close()

    again = client.get(f"/dictionary/{entry_id}", headers=headers)
    assert again.status_code == 200
    assert again.json()["term"] == "Agbada robe"

    deleted = client.delete(f"/dictionary/{entry_id}", headers=headers)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(f"/dictionary/{entry_id}", headers=headers).status_code == 404
    assert entry_id not in [entry["id"] for entry in client.get("/dictionary", headers=headers).json()]
    assert client.get("/wardrobe", headers=headers).json() == []
    assert client.get("/profile", headers=headers).status_code == 404


def test_personal_dictionary_entries_are_private(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _use_fixture(monkeypatch, tmp_path)
    headers_a = _register_and_login(client, "dictuser-a")
    headers_b = _register_and_login(client, "dictuser-b")
    created = client.post("/dictionary", headers=headers_a, json=PERSONAL_ENTRY)
    entry_id = created.json()["id"]

    listed_b = client.get("/dictionary", headers=headers_b)
    assert entry_id not in [entry["id"] for entry in listed_b.json()]
    assert client.get(f"/dictionary/{entry_id}", headers=headers_b).status_code == 404
    assert (
        client.patch(
            f"/dictionary/{entry_id}",
            headers=headers_b,
            json={"term": "Taken"},
        ).status_code
        == 404
    )
    assert client.delete(f"/dictionary/{entry_id}", headers=headers_b).status_code == 404
    assert client.get(f"/dictionary/{entry_id}", headers=headers_a).json()["term"] == "Agbada"


def test_shared_dictionary_entries_are_read_only(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _use_fixture(monkeypatch, tmp_path)
    headers = _register_and_login(client, "dictshared")

    patched = client.patch("/dictionary/kurta", headers=headers, json={"term": "Changed"})
    assert patched.status_code == 403
    assert patched.json()["detail"] == "Shared dictionary entries are read-only"
    assert client.get("/dictionary/kurta", headers=headers).json()["term"] == "Kurta"

    deleted = client.delete("/dictionary/kurta", headers=headers)
    assert deleted.status_code == 403
    assert client.get("/dictionary/kurta", headers=headers).status_code == 200


def test_personal_dictionary_validation(
    client: TestClient,
) -> None:
    headers = _register_and_login(client, "dictvalid")

    blank = client.post(
        "/dictionary",
        headers=headers,
        json={**PERSONAL_ENTRY, "term": "   "},
    )
    assert blank.status_code == 422
    assert "   " not in blank.text
    for err in blank.json()["detail"]:
        assert "input" not in err
        assert "ctx" not in err

    blank_tag = client.post(
        "/dictionary",
        headers=headers,
        json={**PERSONAL_ENTRY, "style_tags": ["  "]},
    )
    assert blank_tag.status_code == 422

    profile_style = client.post(
        "/dictionary",
        headers=headers,
        json={**PERSONAL_ENTRY, "styles": ["Yoruba"]},
    )
    assert profile_style.status_code == 422

    spoofed = client.post(
        "/dictionary",
        headers=headers,
        json={**PERSONAL_ENTRY, "owner_id": "someone-else", "origin": "shared", "id": "kurta"},
    )
    assert spoofed.status_code == 422
    assert any("owner_id" in err.get("loc", []) for err in spoofed.json()["detail"])

    created = client.post("/dictionary", headers=headers, json=PERSONAL_ENTRY)
    entry_id = created.json()["id"]

    empty_patch = client.patch(f"/dictionary/{entry_id}", headers=headers, json={})
    assert empty_patch.status_code == 422

    null_term = client.patch(f"/dictionary/{entry_id}", headers=headers, json={"term": None})
    assert null_term.status_code == 422
    assert client.get(f"/dictionary/{entry_id}", headers=headers).json()["term"] == "Agbada"

    cleared = client.patch(
        f"/dictionary/{entry_id}",
        headers=headers,
        json={"style_tags": [], "pairing_suggestions": []},
    )
    assert cleared.status_code == 200
    assert cleared.json()["style_tags"] == []
    assert cleared.json()["pairing_suggestions"] == []
    assert cleared.json()["occasions"] == ["celebration"]
