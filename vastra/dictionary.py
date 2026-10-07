"""Read-only Style Dictionary loaded from package data.

The shipped catalog is an empty list. Approved entries, when added later,
belong in ``dictionary.json`` next to this module. Suggested terms are not
loaded from this file. A suggestion stays a draft until a person reviews and
approves it. Do not describe a suggestion as verified or currently trending
unless a dated source supports that claim.

Future entry text should stay short and original. Pairings are suggestions,
not dress codes. Describe garments without limiting them by gender or judging
body shape. Weather and comfort notes depend on fabric weight, construction,
fit, and personal preference; they are not guarantees. Do not claim that an
entry is currently trending, and do not invent citations, review dates, or
product links.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import ValidationError

from vastra.schemas import DictionaryEntry, DictionaryKind, PreferredStyle


class DictionaryLoadError(ValueError):
    """The dictionary file is missing or does not match the entry schema."""


def packaged_dictionary_path() -> Path:
    """Path to the catalog, resolved from this module rather than the cwd."""
    return Path(__file__).resolve().parent / "dictionary.json"


def load_dictionary(path: Path | None = None) -> list[DictionaryEntry]:
    source = packaged_dictionary_path() if path is None else path
    try:
        raw_text = source.read_text(encoding="utf-8")
    except OSError as exc:
        raise DictionaryLoadError(f"Could not read dictionary file: {source.name}") from exc

    try:
        raw = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise DictionaryLoadError("Dictionary file must be valid JSON") from exc

    if not isinstance(raw, list):
        raise DictionaryLoadError("Dictionary file must contain a list")

    entries: list[DictionaryEntry] = []
    seen: set[str] = set()
    for index, item in enumerate(raw):
        try:
            entry = DictionaryEntry.model_validate(item)
        except ValidationError as exc:
            raise DictionaryLoadError(
                f"Dictionary entry at index {index} does not match the schema"
            ) from exc
        if entry.id in seen:
            raise DictionaryLoadError(f"Duplicate dictionary id: {entry.id}")
        seen.add(entry.id)
        entries.append(entry)

    return _sorted_entries(entries)


def search_dictionary(
    entries: list[DictionaryEntry],
    *,
    q: str | None = None,
    style: PreferredStyle | None = None,
    kind: DictionaryKind | None = None,
    tag: str | None = None,
) -> list[DictionaryEntry]:
    """Apply optional filters with AND. Blank search text or tag does not filter."""
    query = (q or "").strip().casefold()
    tag_filter = (tag or "").strip().casefold()
    matched: list[DictionaryEntry] = []
    for entry in entries:
        if style is not None and style not in entry.styles:
            continue
        if kind is not None and entry.kind != kind:
            continue
        if query and not _matches_query(entry, query):
            continue
        if tag_filter and not _matches_tag(entry, tag_filter):
            continue
        matched.append(entry)
    return _sorted_entries(matched)


def find_dictionary_entry(
    entries: list[DictionaryEntry],
    entry_id: str,
) -> DictionaryEntry | None:
    for entry in entries:
        if entry.id == entry_id:
            return entry
    return None


def _matches_query(entry: DictionaryEntry, query: str) -> bool:
    haystack = [entry.term, entry.definition, *entry.aliases]
    return any(query in part.casefold() for part in haystack)


def _matches_tag(entry: DictionaryEntry, tag: str) -> bool:
    """Case-insensitive exact match against style_tags. Tag is already trimmed."""
    return any(item.casefold() == tag for item in entry.style_tags)


def _sorted_entries(entries: list[DictionaryEntry]) -> list[DictionaryEntry]:
    return sorted(entries, key=lambda entry: (entry.term.casefold(), entry.id))
