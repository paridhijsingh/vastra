"""Shared synthetic demo catalog. Credentials are never stored here."""

from __future__ import annotations

from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from vastra.auth import hash_password, verify_password
from vastra.config import Settings, get_settings
from vastra.models import StyleProfile, User, WardrobeItem

NOT_CONFIGURED = "Demo sign-in is not configured."
NOT_SEEDED = "The demo account has not been seeded. Run python scripts/seed_demo.py."
WARDROBE_NOT_EMPTY = "Demo clothes are only added to an empty wardrobe."
NAME_PREFIX = "Demo —"


class DemoNotConfiguredError(Exception):
    def __init__(self) -> None:
        super().__init__(NOT_CONFIGURED)
        self.message = NOT_CONFIGURED


class DemoNotSeededError(Exception):
    def __init__(self) -> None:
        super().__init__(NOT_SEEDED)
        self.message = NOT_SEEDED


class DemoWardrobeOccupiedError(Exception):
    def __init__(self) -> None:
        super().__init__(WARDROBE_NOT_EMPTY)
        self.message = WARDROBE_NOT_EMPTY


class DemoItem(TypedDict):
    name: str
    category: str
    color: str
    notes: str
    availability: str


DEMO_PROFILE: dict[str, object] = {
    "styling_preference": "unisex",
    "preferred_styles": ["Indian", "Western", "fusion"],
    "preferred_colors": ["Ivory", "Navy", "Gold", "Emerald"],
    "fit_preferences": ["Relaxed", "Tailored"],
    "comfort_preferences": ["Breathable fabrics"],
    "clothing_to_avoid": ["Stiff heels"],
}

# 13 available + 2 in-laundry. Names are obviously synthetic.
DEMO_WARDROBE_ITEMS: tuple[DemoItem, ...] = (
    {
        "name": "Demo — Ivory silk kurta",
        "category": "top",
        "color": "Ivory",
        "notes": "Synthetic Indian dinner and festive top. Sample garment only.",
        "availability": "available",
    },
    {
        "name": "Demo — Navy palazzo pants",
        "category": "bottom",
        "color": "Navy",
        "notes": "Synthetic Indian dinner bottom. Sample garment only.",
        "availability": "available",
    },
    {
        "name": "Demo — Gold block sandals",
        "category": "shoes",
        "color": "Gold",
        "notes": "Synthetic fusion dinner and wedding-guest shoes. Sample only.",
        "availability": "available",
    },
    {
        "name": "Demo — Cream pashmina shawl",
        "category": "outerwear",
        "color": "Cream",
        "notes": "Synthetic Indian festive wrap. Sample garment only.",
        "availability": "available",
    },
    {
        "name": "Demo — Gold jhumka earrings",
        "category": "accessory",
        "color": "Gold",
        "notes": "Synthetic Indian wedding-guest accessory. Sample only.",
        "availability": "available",
    },
    {
        "name": "Demo — Navy blazer",
        "category": "outerwear",
        "color": "Navy",
        "notes": "Synthetic Western job-interview jacket. Sample garment only.",
        "availability": "available",
    },
    {
        "name": "Demo — White oxford shirt",
        "category": "top",
        "color": "White",
        "notes": "Synthetic Western job-interview shirt. Sample garment only.",
        "availability": "available",
    },
    {
        "name": "Demo — Charcoal trousers",
        "category": "bottom",
        "color": "Charcoal",
        "notes": "Synthetic Western job-interview trousers. Sample garment only.",
        "availability": "available",
    },
    {
        "name": "Demo — Black leather oxfords",
        "category": "shoes",
        "color": "Black",
        "notes": "Synthetic Western interview shoes. Sample garment only.",
        "availability": "available",
    },
    {
        "name": "Demo — Emerald festive anarkali",
        "category": "one_piece",
        "color": "Emerald",
        "notes": "Synthetic Indian festive and wedding-guest one piece. Sample only.",
        "availability": "available",
    },
    {
        "name": "Demo — Black wrap dress",
        "category": "one_piece",
        "color": "Black",
        "notes": "Synthetic Western dinner one piece. Sample garment only.",
        "availability": "available",
    },
    {
        "name": "Demo — Maroon fusion nehru jacket",
        "category": "outerwear",
        "color": "Maroon",
        "notes": "Synthetic fusion festive jacket. Sample garment only.",
        "availability": "available",
    },
    {
        "name": "Demo — Pearl drop necklace",
        "category": "accessory",
        "color": "Ivory",
        "notes": "Synthetic Western wedding-guest accessory. Sample only.",
        "availability": "available",
    },
    {
        "name": "Demo — Indigo denim jacket",
        "category": "outerwear",
        "color": "Indigo",
        "notes": "Synthetic Western layer marked in laundry so filters are visible.",
        "availability": "in_laundry",
    },
    {
        "name": "Demo — White sneakers",
        "category": "shoes",
        "color": "White",
        "notes": "Synthetic Western shoes marked in laundry so filters are visible.",
        "availability": "in_laundry",
    },
)


def demo_credentials(settings: Settings | None = None) -> tuple[str, str]:
    """Return (username, password) from DEMO_EMAIL / DEMO_PASSWORD. Never log these."""
    settings = settings or get_settings()
    username = (settings.demo_email or "").strip()
    password = settings.demo_password or ""
    if not username or not password:
        raise DemoNotConfiguredError
    if len(username) < 3 or len(username) > 64:
        raise DemoNotConfiguredError
    if len(password) < 8 or len(password) > 128:
        raise DemoNotConfiguredError
    return username, password


def _replace_profile(db: Session, owner_id: str) -> None:
    profile = db.scalar(select(StyleProfile).where(StyleProfile.owner_id == owner_id))
    payload = dict(DEMO_PROFILE)
    if profile is None:
        db.add(StyleProfile(owner_id=owner_id, **payload))
        return
    for key, value in payload.items():
        setattr(profile, key, value)


def _replace_wardrobe(db: Session, owner_id: str) -> list[WardrobeItem]:
    existing = list(db.scalars(select(WardrobeItem).where(WardrobeItem.owner_id == owner_id)).all())
    for item in existing:
        db.delete(item)
    db.flush()
    created: list[WardrobeItem] = []
    for spec in DEMO_WARDROBE_ITEMS:
        item = WardrobeItem(owner_id=owner_id, **spec)
        db.add(item)
        created.append(item)
    db.flush()
    return created


def seed_demo_account(db: Session, username: str, password: str) -> User:
    """Create or refresh the demo user, profile, and synthetic wardrobe. Owner-scoped."""
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(username=username, password_hash=hash_password(password))
        db.add(user)
        db.flush()
    else:
        user.password_hash = hash_password(password)
    _replace_profile(db, user.id)
    _replace_wardrobe(db, user.id)
    return user


def copy_demo_wardrobe(db: Session, owner_id: str) -> list[WardrobeItem]:
    """Copy the synthetic catalog into an empty wardrobe owned by this user."""
    existing = list(db.scalars(select(WardrobeItem).where(WardrobeItem.owner_id == owner_id)).all())
    if existing:
        raise DemoWardrobeOccupiedError
    created: list[WardrobeItem] = []
    for spec in DEMO_WARDROBE_ITEMS:
        item = WardrobeItem(owner_id=owner_id, **spec)
        db.add(item)
        created.append(item)
    db.flush()
    return created


def authenticate_demo_user(db: Session, settings: Settings | None = None) -> User:
    username, password = demo_credentials(settings)
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(password, user.password_hash):
        raise DemoNotSeededError
    return user
