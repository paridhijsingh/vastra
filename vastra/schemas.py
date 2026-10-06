"""Pydantic request and response schemas."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

StylingPreference = Literal["men", "women", "unisex"]
PreferredStyle = Literal["Indian", "Western", "fusion"]

NonBlankTrimmedStr = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=64),
]


def _normalize_string_list(value: object, *, max_items: int) -> list[str]:
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
        if len(trimmed) > 64:
            raise ValueError("List entries must be at most 64 characters")
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
