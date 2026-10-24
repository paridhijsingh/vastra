"""Confirmed styling preferences. These rows are guidance, not wardrobe facts."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from vastra.models import ConfirmedPreference
from vastra.schemas import PREFERENCE_LIMIT, ConfirmedPreferenceBody


class PreferenceLimitError(Exception):
    """The owner already has the maximum number of saved preferences."""


def list_preferences(db: Session, owner_id: str) -> list[ConfirmedPreference]:
    return list(
        db.scalars(
            select(ConfirmedPreference)
            .where(ConfirmedPreference.owner_id == owner_id)
            .order_by(ConfirmedPreference.created_at, ConfirmedPreference.id)
        )
    )


def get_preference(db: Session, owner_id: str, preference_id: str) -> ConfirmedPreference | None:
    return db.scalar(
        select(ConfirmedPreference).where(
            ConfirmedPreference.id == preference_id,
            ConfirmedPreference.owner_id == owner_id,
        )
    )


def create_preference(db: Session, owner_id: str, body: ConfirmedPreferenceBody) -> ConfirmedPreference:
    if len(list_preferences(db, owner_id)) >= PREFERENCE_LIMIT:
        raise PreferenceLimitError
    row = ConfirmedPreference(
        owner_id=owner_id,
        topic=body.topic,
        statement=body.statement,
        occasion=body.occasion,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_preference(
    db: Session,
    row: ConfirmedPreference,
    body: ConfirmedPreferenceBody,
) -> ConfirmedPreference:
    row.topic = body.topic
    row.statement = body.statement
    row.occasion = body.occasion
    db.commit()
    db.refresh(row)
    return row


def delete_preference(db: Session, row: ConfirmedPreference) -> None:
    db.delete(row)
    db.commit()


def preference_prompt_rows(rows: list[ConfirmedPreference]) -> list[dict[str, str | None]]:
    """Fields sent to the model. They do not include ids that could be treated as wardrobe ids."""
    return [
        {"topic": row.topic, "statement": row.statement, "occasion": row.occasion}
        for row in rows
    ]
