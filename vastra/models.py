"""SQLAlchemy ORM models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from vastra.db import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        nullable=False,
    )


class StyleProfile(Base):
    __tablename__ = "style_profiles"
    __table_args__ = (UniqueConstraint("owner_id", name="uq_style_profiles_owner_id"),)

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    owner_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    styling_preference: Mapped[str] = mapped_column(String(16), nullable=False)
    preferred_styles: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    preferred_colors: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    fit_preferences: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    comfort_preferences: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    clothing_to_avoid: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        onupdate=_utc_now,
        nullable=False,
    )


class WardrobeItem(Base):
    __tablename__ = "wardrobe_items"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    owner_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    color: Mapped[str] = mapped_column(String(64), nullable=False)
    notes: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    availability: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="available",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        onupdate=_utc_now,
        nullable=False,
    )


class PersonalDictionaryEntry(Base):
    """A private dictionary entry. The shared catalog stays in JSON."""

    __tablename__ = "personal_dictionary_entries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    term: Mapped[str] = mapped_column(String(80), nullable=False)
    aliases: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    definition: Mapped[str] = mapped_column(String(600), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    styles: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    style_tags: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    cultural_context: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pairing_suggestions: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    occasions: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    weather_notes: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    comfort_notes: Mapped[list] = mapped_column(JSON, nullable=False, insert_default=list)
    guidance_type: Mapped[str] = mapped_column(String(16), nullable=False, default="general")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        onupdate=_utc_now,
        nullable=False,
    )
