"""Private saved looks. Reads wardrobe details; never calls the model."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from vastra.models import SavedLook, SavedLookItem, WardrobeItem
from vastra.schemas import (
    REMOVED_ITEM_NOTICE,
    SavedLookCreate,
    SavedLookPublic,
    SavedLookRemovedItem,
    SavedLookUpdate,
    SavedLookWardrobeItem,
)

LOOK_NOT_FOUND = "Saved look not found."
WARDROBE_ITEM_NOT_FOUND = "Wardrobe item not found."


def _owned_look(db: Session, owner_id: str, look_id: str) -> SavedLook | None:
    return db.scalar(
        select(SavedLook).where(
            SavedLook.id == look_id,
            SavedLook.owner_id == owner_id,
        )
    )


def _require_look(db: Session, owner_id: str, look_id: str) -> SavedLook:
    look = _owned_look(db, owner_id, look_id)
    if look is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=LOOK_NOT_FOUND)
    return look


def _owned_wardrobe_items(
    db: Session,
    owner_id: str,
    item_ids: list[str],
) -> dict[str, WardrobeItem]:
    rows = db.scalars(
        select(WardrobeItem).where(
            WardrobeItem.owner_id == owner_id,
            WardrobeItem.id.in_(item_ids),
        )
    ).all()
    found = {row.id: row for row in rows}
    if set(found) != set(item_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=WARDROBE_ITEM_NOT_FOUND)
    return found


def public_look(db: Session, look: SavedLook) -> SavedLookPublic:
    slots = db.scalars(
        select(SavedLookItem)
        .where(SavedLookItem.look_id == look.id)
        .order_by(SavedLookItem.position.asc())
    ).all()
    linked_ids = [slot.wardrobe_item_id for slot in slots if slot.wardrobe_item_id]
    rows = []
    if linked_ids:
        rows = db.scalars(
            select(WardrobeItem).where(
                WardrobeItem.owner_id == look.owner_id,
                WardrobeItem.id.in_(linked_ids),
            )
        ).all()
    by_id = {row.id: row for row in rows}
    items: list[SavedLookWardrobeItem | SavedLookRemovedItem] = []
    for slot in slots:
        row = by_id.get(slot.wardrobe_item_id) if slot.wardrobe_item_id else None
        if row is None:
            items.append(SavedLookRemovedItem())
            continue
        items.append(
            SavedLookWardrobeItem(
                id=row.id,
                name=row.name,
                category=row.category,
                color=row.color,
                notes=row.notes,
                availability=row.availability,
            )
        )
    removed = any(item.missing for item in items)
    return SavedLookPublic(
        id=look.id,
        name=look.name,
        occasion=look.occasion,
        notes=look.notes,
        contains_removed_items=removed,
        removed_item_notice=REMOVED_ITEM_NOTICE if removed else None,
        items=items,
        created_at=look.created_at,
        updated_at=look.updated_at,
    )


def create_look(db: Session, owner_id: str, body: SavedLookCreate) -> SavedLookPublic:
    _owned_wardrobe_items(db, owner_id, body.item_ids)
    look = SavedLook(
        id=str(uuid.uuid4()),
        owner_id=owner_id,
        name=body.name,
        occasion=body.occasion,
        notes=body.notes,
    )
    db.add(look)
    db.flush()
    for position, item_id in enumerate(body.item_ids):
        db.add(
            SavedLookItem(
                id=str(uuid.uuid4()),
                look_id=look.id,
                position=position,
                wardrobe_item_id=item_id,
            )
        )
    db.commit()
    db.refresh(look)
    return public_look(db, look)


def list_looks(db: Session, owner_id: str) -> list[SavedLookPublic]:
    looks = db.scalars(
        select(SavedLook)
        .where(SavedLook.owner_id == owner_id)
        .order_by(SavedLook.created_at.desc(), SavedLook.id.desc())
    ).all()
    return [public_look(db, look) for look in looks]


def get_look(db: Session, owner_id: str, look_id: str) -> SavedLookPublic:
    return public_look(db, _require_look(db, owner_id, look_id))


def update_look(
    db: Session,
    owner_id: str,
    look_id: str,
    body: SavedLookUpdate,
) -> SavedLookPublic:
    look = _require_look(db, owner_id, look_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(look, key, value)
    db.commit()
    db.refresh(look)
    return public_look(db, look)


def delete_look(db: Session, owner_id: str, look_id: str) -> None:
    look = _require_look(db, owner_id, look_id)
    db.delete(look)
    db.commit()
