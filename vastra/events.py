"""Private saved events. A look is referenced, never copied. No model calls."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from vastra.models import Event, SavedLook
from vastra.schemas import EventCreate, EventPublic, EventUpdate

EVENT_NOT_FOUND = "Event not found."
LOOK_NOT_FOUND = "Saved look not found."


def _owned_event(db: Session, owner_id: str, event_id: str) -> Event | None:
    return db.scalar(
        select(Event).where(
            Event.id == event_id,
            Event.owner_id == owner_id,
        )
    )


def _require_event(db: Session, owner_id: str, event_id: str) -> Event:
    event = _owned_event(db, owner_id, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=EVENT_NOT_FOUND)
    return event


def _owned_look(db: Session, owner_id: str, look_id: str) -> SavedLook:
    look = db.scalar(
        select(SavedLook).where(
            SavedLook.id == look_id,
            SavedLook.owner_id == owner_id,
        )
    )
    if look is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=LOOK_NOT_FOUND)
    return look


def public_event(db: Session, event: Event) -> EventPublic:
    look_name = None
    look_id = event.look_id
    if look_id is not None:
        look = db.scalar(
            select(SavedLook).where(
                SavedLook.id == look_id,
                SavedLook.owner_id == event.owner_id,
            )
        )
        if look is None:
            look_id = None
        else:
            look_name = look.name
    return EventPublic(
        id=event.id,
        name=event.name,
        event_date=event.event_date,
        occasion=event.occasion,
        notes=event.notes,
        comfort_needs=list(event.comfort_needs or []),
        look_id=look_id,
        look_name=look_name,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


def create_event(db: Session, owner_id: str, body: EventCreate) -> EventPublic:
    if body.look_id is not None:
        _owned_look(db, owner_id, body.look_id)
    event = Event(
        id=str(uuid.uuid4()),
        owner_id=owner_id,
        name=body.name,
        event_date=body.event_date,
        occasion=body.occasion,
        notes=body.notes,
        comfort_needs=list(body.comfort_needs),
        look_id=body.look_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return public_event(db, event)


def list_events(db: Session, owner_id: str) -> list[EventPublic]:
    events = db.scalars(
        select(Event)
        .where(Event.owner_id == owner_id)
        .order_by(Event.event_date.asc(), Event.id.asc())
    ).all()
    return [public_event(db, event) for event in events]


def get_event(db: Session, owner_id: str, event_id: str) -> EventPublic:
    return public_event(db, _require_event(db, owner_id, event_id))


def update_event(db: Session, owner_id: str, event_id: str, body: EventUpdate) -> EventPublic:
    event = _require_event(db, owner_id, event_id)
    updates = body.model_dump(exclude_unset=True)
    if "look_id" in updates and updates["look_id"] is not None:
        _owned_look(db, owner_id, updates["look_id"])
    for key, value in updates.items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return public_event(db, event)


def delete_event(db: Session, owner_id: str, event_id: str) -> None:
    event = _require_event(db, owner_id, event_id)
    db.delete(event)
    db.commit()


def detach_look(db: Session, look_id: str) -> None:
    """Clear event references before a look row is deleted."""
    events = db.scalars(select(Event).where(Event.look_id == look_id)).all()
    for event in events:
        event.look_id = None
    if events:
        db.flush()
