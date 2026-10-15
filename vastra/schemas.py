"""Pydantic request and response schemas."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

StylingPreference = Literal["men", "women", "unisex"]
PreferredStyle = Literal["Indian", "Western", "fusion"]
# Dictionary broad styles are a separate enum from saved profile styles.
DictionaryStyle = Literal["Indian", "Western", "fusion"]

NonBlankTrimmedStr = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=64),
]


def _normalize_string_list(
    value: object,
    *,
    max_items: int,
    max_length: int = 64,
) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("Expected a list")
    if len(value) > max_items:
        raise ValueError(f"List must contain at most {max_items} items")
    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ValueError("List entries must be strings")
        trimmed = item.strip()
        if not trimmed:
            raise ValueError("List entries must not be blank")
        if len(trimmed) > max_length:
            raise ValueError(f"List entries must be at most {max_length} characters")
        normalized.append(trimmed)
    return normalized


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserPublic(BaseModel):
    id: str
    username: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpsert(BaseModel):
    """Full profile payload for create/replace. Ownership is never client-supplied."""

    model_config = ConfigDict(extra="forbid")

    styling_preference: StylingPreference
    preferred_styles: list[PreferredStyle] = Field(default_factory=list, max_length=3)
    preferred_colors: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=32)
    fit_preferences: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=32)
    comfort_preferences: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=32)
    clothing_to_avoid: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=32)

    @field_validator("preferred_styles", mode="before")
    @classmethod
    def normalize_preferred_styles(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=3)

    @field_validator(
        "preferred_colors",
        "fit_preferences",
        "comfort_preferences",
        "clothing_to_avoid",
        mode="before",
    )
    @classmethod
    def normalize_preference_lists(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=32)


class ProfilePublic(BaseModel):
    owner_id: str
    styling_preference: StylingPreference
    preferred_styles: list[PreferredStyle]
    preferred_colors: list[str]
    fit_preferences: list[str]
    comfort_preferences: list[str]
    clothing_to_avoid: list[str]

    model_config = ConfigDict(from_attributes=True)


AvailabilityStatus = Literal["available", "in_laundry", "packed_away"]
ItemCategory = Literal[
    "top",
    "bottom",
    "one_piece",
    "outerwear",
    "shoes",
    "accessory",
    "other",
]

ItemName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=128),
]
ItemColor = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=64),
]
ItemNotes = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=512),
]


class WardrobeItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ItemName
    category: ItemCategory
    color: ItemColor
    notes: ItemNotes = ""
    availability: AvailabilityStatus = "available"


class WardrobeItemUpdate(BaseModel):
    """Partial update; omit fields that should stay unchanged."""

    model_config = ConfigDict(extra="forbid")

    name: ItemName | None = None
    category: ItemCategory | None = None
    color: ItemColor | None = None
    notes: ItemNotes | None = None
    availability: AvailabilityStatus | None = None


class WardrobeItemPublic(BaseModel):
    id: str
    owner_id: str
    name: str
    category: ItemCategory
    color: str
    notes: str
    availability: AvailabilityStatus

    model_config = ConfigDict(from_attributes=True)


OccasionText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
]


class EmergencyFitRequest(BaseModel):
    """Occasion request. Profile and ownership come from the authenticated user."""

    model_config = ConfigDict(extra="forbid")

    occasion: OccasionText
    vibe: str | None = None
    comfort_needs: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=16)

    @field_validator("vibe", mode="before")
    @classmethod
    def blank_vibe_is_none(cls, value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("vibe must be a string")
        trimmed = value.strip()
        if not trimmed:
            return None
        if len(trimmed) > 200:
            raise ValueError("vibe must be at most 200 characters")
        return trimmed

    @field_validator("comfort_needs", mode="before")
    @classmethod
    def normalize_comfort_needs(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=16, max_length=64)


OUTFIT_REASON_MAX = 300
OUTFIT_ITEM_ID_COUNT_MAX = 8


class OutfitModelResult(BaseModel):
    """Structured model output. Item names are not accepted from the model."""

    model_config = ConfigDict(extra="forbid")

    item_ids: list[str] = Field(min_length=1, max_length=OUTFIT_ITEM_ID_COUNT_MAX)
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=OUTFIT_REASON_MAX)]

    @field_validator("item_ids")
    @classmethod
    def unique_item_ids(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item_id in value:
            if not isinstance(item_id, str) or not item_id.strip():
                raise ValueError("item_ids must be nonblank strings")
            cleaned.append(item_id.strip())
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("item_ids must be unique")
        return cleaned


class OutfitItemPublic(BaseModel):
    """Wardrobe details loaded from the database for the signed-in user."""

    id: str
    name: str
    category: ItemCategory
    color: str
    notes: str
    availability: Literal["available"]


class EmergencyOutfitPublic(BaseModel):
    title: str
    items: list[OutfitItemPublic]
    explanation: str
    styling_tips: list[str]
    limitations: str


ChangeRequestText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=300),
]


class RescueOutfitRequest(BaseModel):
    """Replace one piece of an outfit the caller already holds. Ownership comes from the session."""

    model_config = ConfigDict(extra="forbid")

    item_ids: list[str] = Field(min_length=1, max_length=OUTFIT_ITEM_ID_COUNT_MAX)
    replace_item_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    occasion: OccasionText
    change_request: ChangeRequestText
    comfort_needs: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=16)

    @field_validator("item_ids")
    @classmethod
    def unique_item_ids(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item_id in value:
            if not isinstance(item_id, str) or not item_id.strip():
                raise ValueError("item_ids must be nonblank strings")
            cleaned.append(item_id.strip())
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("item_ids must be unique")
        return cleaned

    @field_validator("comfort_needs", mode="before")
    @classmethod
    def normalize_comfort_needs(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=16, max_length=64)

    @model_validator(mode="after")
    def replace_item_is_in_the_outfit(self) -> "RescueOutfitRequest":
        if self.replace_item_id not in self.item_ids:
            raise ValueError("replace_item_id must be one of item_ids")
        return self


class RescueModelResult(BaseModel):
    """One candidate id and a short reason. No item names."""

    model_config = ConfigDict(extra="forbid")

    replacement_item_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=OUTFIT_REASON_MAX)]


class RescueOutfitPublic(BaseModel):
    title: str
    items: list[OutfitItemPublic]
    explanation: str
    styling_tips: list[str]
    limitations: str
    replaced_item_id: str
    replacement_item_id: str


LOOK_NAME_MAX = 100
LOOK_OCCASION_MAX = 200
LOOK_NOTES_MAX = 1000
LOOK_ITEM_ID_MAX = 30
REMOVED_ITEM_NOTICE = "This look includes a wardrobe item that was removed."

LookName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=LOOK_NAME_MAX),
]


def _optional_look_text(value: object, *, max_length: int, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    trimmed = value.strip()
    if not trimmed:
        return None
    if len(trimmed) > max_length:
        raise ValueError(f"{field} must be at most {max_length} characters")
    return trimmed


class SavedLookCreate(BaseModel):
    """Save an ordered plan. Ownership and item details come from the server."""

    model_config = ConfigDict(extra="forbid")

    name: LookName
    occasion: str | None = None
    notes: str | None = None
    item_ids: list[str] = Field(min_length=1, max_length=LOOK_ITEM_ID_MAX)

    @field_validator("occasion", mode="before")
    @classmethod
    def normalize_occasion(cls, value: object) -> str | None:
        return _optional_look_text(value, max_length=LOOK_OCCASION_MAX, field="occasion")

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_notes(cls, value: object) -> str | None:
        return _optional_look_text(value, max_length=LOOK_NOTES_MAX, field="notes")

    @field_validator("item_ids")
    @classmethod
    def unique_item_ids(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item_id in value:
            if not isinstance(item_id, str) or not item_id.strip():
                raise ValueError("item_ids must be nonblank strings")
            cleaned.append(item_id.strip())
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("item_ids must be unique")
        return cleaned


class SavedLookUpdate(BaseModel):
    """Rename or edit text. Item membership is unchanged in this milestone."""

    model_config = ConfigDict(extra="forbid")

    name: LookName | None = None
    occasion: str | None = None
    notes: str | None = None

    @model_validator(mode="before")
    @classmethod
    def reject_null_name(cls, value: object) -> object:
        if isinstance(value, dict) and "name" in value and value["name"] is None:
            raise ValueError("name must not be null")
        return value

    @model_validator(mode="after")
    def reject_empty_update(self) -> "SavedLookUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        return self

    @field_validator("occasion", mode="before")
    @classmethod
    def normalize_occasion(cls, value: object) -> str | None:
        return _optional_look_text(value, max_length=LOOK_OCCASION_MAX, field="occasion")

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_notes(cls, value: object) -> str | None:
        return _optional_look_text(value, max_length=LOOK_NOTES_MAX, field="notes")


class SavedLookWardrobeItem(BaseModel):
    """Current wardrobe details. Not a copy stored on the look."""

    missing: Literal[False] = False
    id: str
    name: str
    category: ItemCategory
    color: str
    notes: str
    availability: AvailabilityStatus


class SavedLookRemovedItem(BaseModel):
    """Position kept after the wardrobe garment was deleted."""

    missing: Literal[True] = True


class SavedLookPublic(BaseModel):
    id: str
    name: str
    occasion: str | None
    notes: str | None
    contains_removed_items: bool
    removed_item_notice: str | None
    items: list[SavedLookWardrobeItem | SavedLookRemovedItem]
    created_at: datetime
    updated_at: datetime


DictionaryKind = Literal["garment", "fabric", "silhouette", "styling_technique"]
DictionaryGuidanceType = Literal["general"]

DictionarySlug = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"),
]
DictionaryTerm = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=80),
]
DictionaryDefinition = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=600),
]
DictionaryNote = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=280),
]


DictionaryOrigin = Literal["shared", "personal"]

_DICTIONARY_NULL_FORBIDDEN = (
    "term",
    "definition",
    "kind",
    "guidance_type",
    "aliases",
    "styles",
    "style_tags",
    "pairing_suggestions",
    "occasions",
    "weather_notes",
    "comfort_notes",
)


def _normalize_cultural_context(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("cultural_context must be a string")
    trimmed = value.strip()
    if not trimmed:
        return None
    if len(trimmed) > 200:
        raise ValueError("cultural_context must be at most 200 characters")
    return trimmed


class DictionaryEntry(BaseModel):
    """Approved general guidance. Not a trend claim.

    `styles` uses the dictionary style enum, which is separate from saved
    profile styles. `style_tags` can name additional cultural styles.
    Optional `cultural_context` names a more specific setting when one applies.

    Pairing, weather, and comfort notes are suggestions. They are not rules,
    guarantees, or gender or body-shape judgments.
    """

    model_config = ConfigDict(extra="forbid")

    id: DictionarySlug
    origin: DictionaryOrigin = "shared"
    term: DictionaryTerm
    aliases: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=16)
    definition: DictionaryDefinition
    kind: DictionaryKind
    styles: list[DictionaryStyle] = Field(default_factory=list, max_length=3)
    style_tags: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=16)
    cultural_context: str | None = None
    pairing_suggestions: list[DictionaryNote] = Field(default_factory=list, max_length=12)
    occasions: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=16)
    weather_notes: list[DictionaryNote] = Field(default_factory=list, max_length=12)
    comfort_notes: list[DictionaryNote] = Field(default_factory=list, max_length=12)
    guidance_type: DictionaryGuidanceType

    @field_validator("aliases", "style_tags", "occasions", mode="before")
    @classmethod
    def normalize_short_lists(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=16)

    @field_validator("styles", mode="before")
    @classmethod
    def normalize_styles(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=3)

    @field_validator("pairing_suggestions", "weather_notes", "comfort_notes", mode="before")
    @classmethod
    def normalize_notes(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=12, max_length=280)

    @field_validator("cultural_context", mode="before")
    @classmethod
    def normalize_cultural_context(cls, value: object) -> str | None:
        return _normalize_cultural_context(value)


class DictionaryEntryCreate(BaseModel):
    """Personal entry payload. Identity and origin are assigned by the server."""

    model_config = ConfigDict(extra="forbid")

    term: DictionaryTerm
    definition: DictionaryDefinition
    kind: DictionaryKind
    aliases: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=16)
    styles: list[DictionaryStyle] = Field(default_factory=list, max_length=3)
    style_tags: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=16)
    cultural_context: str | None = None
    pairing_suggestions: list[DictionaryNote] = Field(default_factory=list, max_length=12)
    occasions: list[NonBlankTrimmedStr] = Field(default_factory=list, max_length=16)
    weather_notes: list[DictionaryNote] = Field(default_factory=list, max_length=12)
    comfort_notes: list[DictionaryNote] = Field(default_factory=list, max_length=12)
    guidance_type: DictionaryGuidanceType = "general"

    @field_validator("aliases", "style_tags", "occasions", mode="before")
    @classmethod
    def normalize_short_lists(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=16)

    @field_validator("styles", mode="before")
    @classmethod
    def normalize_styles(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=3)

    @field_validator("pairing_suggestions", "weather_notes", "comfort_notes", mode="before")
    @classmethod
    def normalize_notes(cls, value: object) -> list[str]:
        return _normalize_string_list(value, max_items=12, max_length=280)

    @field_validator("cultural_context", mode="before")
    @classmethod
    def normalize_cultural_context(cls, value: object) -> str | None:
        return _normalize_cultural_context(value)


class DictionaryEntryUpdate(BaseModel):
    """Partial personal-entry update. Omitted fields stay unchanged."""

    model_config = ConfigDict(extra="forbid")

    term: DictionaryTerm | None = None
    definition: DictionaryDefinition | None = None
    kind: DictionaryKind | None = None
    aliases: list[NonBlankTrimmedStr] | None = None
    styles: list[DictionaryStyle] | None = None
    style_tags: list[NonBlankTrimmedStr] | None = None
    cultural_context: str | None = None
    pairing_suggestions: list[DictionaryNote] | None = None
    occasions: list[NonBlankTrimmedStr] | None = None
    weather_notes: list[DictionaryNote] | None = None
    comfort_notes: list[DictionaryNote] | None = None
    guidance_type: DictionaryGuidanceType | None = None

    @model_validator(mode="before")
    @classmethod
    def reject_null_required_fields(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        for field in _DICTIONARY_NULL_FORBIDDEN:
            if field in value and value[field] is None:
                raise ValueError(f"{field} must not be null")
        return value

    @model_validator(mode="after")
    def reject_empty_update(self) -> "DictionaryEntryUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        return self

    @field_validator("aliases", "style_tags", "occasions", mode="before")
    @classmethod
    def normalize_short_lists(cls, value: object) -> object:
        if value is None:
            return value
        return _normalize_string_list(value, max_items=16)

    @field_validator("styles", mode="before")
    @classmethod
    def normalize_styles(cls, value: object) -> object:
        if value is None:
            return value
        return _normalize_string_list(value, max_items=3)

    @field_validator("pairing_suggestions", "weather_notes", "comfort_notes", mode="before")
    @classmethod
    def normalize_notes(cls, value: object) -> object:
        if value is None:
            return value
        return _normalize_string_list(value, max_items=12, max_length=280)

    @field_validator("cultural_context", mode="before")
    @classmethod
    def normalize_cultural_context(cls, value: object) -> str | None:
        return _normalize_cultural_context(value)
