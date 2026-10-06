"""FastAPI application for Vastra AI."""

from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from vastra.auth import create_access_token, get_current_user, hash_password, verify_password
from vastra.db import get_db, init_db
from vastra.models import StyleProfile, User, WardrobeItem
from vastra.schemas import (
    LoginRequest,
    ProfilePublic,
    ProfileUpsert,
    RegisterRequest,
    TokenResponse,
    UserPublic,
    WardrobeItemCreate,
    WardrobeItemPublic,
    WardrobeItemUpdate,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Vastra AI", lifespan=lifespan)


def _public_validation_error(error: dict[str, Any]) -> dict[str, Any]:
    """Keep field location and message; omit submitted values and extra context."""
    public: dict[str, Any] = {}
    if "type" in error:
        public["type"] = error["type"]
    if "loc" in error:
        public["loc"] = error["loc"]
    if "msg" in error:
        public["msg"] = error["msg"]
    return public


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    # Do not log request bodies, passwords, or tokens.
    return JSONResponse(
        status_code=422,
        content={"detail": [_public_validation_error(err) for err in exc.errors()]},
    )


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "Vastra AI", "status": "running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered",
        ) from None
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == body.username))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(access_token=create_access_token(user_id=user.id))


@app.get("/auth/me", response_model=UserPublic)
def auth_me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


def _get_owned_profile(db: Session, owner_id: str) -> StyleProfile | None:
    return db.scalar(select(StyleProfile).where(StyleProfile.owner_id == owner_id))


@app.get("/profile", response_model=ProfilePublic)
def get_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> StyleProfile:
    profile = _get_owned_profile(db, current_user.id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


@app.put("/profile", response_model=ProfilePublic)
def put_profile(
    body: ProfileUpsert,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> StyleProfile:
    profile = _get_owned_profile(db, current_user.id)
    payload = body.model_dump()
    if profile is None:
        profile = StyleProfile(owner_id=current_user.id, **payload)
        db.add(profile)
    else:
        for key, value in payload.items():
            setattr(profile, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Unique owner_id race: reload and replace the existing row.
        profile = _get_owned_profile(db, current_user.id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Could not save profile",
            ) from None
        for key, value in payload.items():
            setattr(profile, key, value)
        db.commit()
    db.refresh(profile)
    return profile


@app.delete("/profile", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    profile = _get_owned_profile(db, current_user.id)
    if profile is not None:
        db.delete(profile)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_owned_wardrobe_item(
    db: Session,
    *,
    owner_id: str,
    item_id: str,
) -> WardrobeItem | None:
    return db.scalar(
        select(WardrobeItem).where(
            WardrobeItem.id == item_id,
            WardrobeItem.owner_id == owner_id,
        )
    )


@app.get("/wardrobe", response_model=list[WardrobeItemPublic])
def list_wardrobe(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[WardrobeItem]:
    return list(
        db.scalars(
            select(WardrobeItem)
            .where(WardrobeItem.owner_id == current_user.id)
            .order_by(WardrobeItem.created_at.asc())
        ).all()
    )


@app.post("/wardrobe", response_model=WardrobeItemPublic, status_code=status.HTTP_201_CREATED)
def create_wardrobe_item(
    body: WardrobeItemCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WardrobeItem:
    item = WardrobeItem(owner_id=current_user.id, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/wardrobe/{item_id}", response_model=WardrobeItemPublic)
def get_wardrobe_item(
    item_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WardrobeItem:
    item = _get_owned_wardrobe_item(db, owner_id=current_user.id, item_id=item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wardrobe item not found")
    return item


@app.patch("/wardrobe/{item_id}", response_model=WardrobeItemPublic)
def patch_wardrobe_item(
    item_id: str,
    body: WardrobeItemUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WardrobeItem:
    item = _get_owned_wardrobe_item(db, owner_id=current_user.id, item_id=item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wardrobe item not found")
    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@app.delete(
    "/wardrobe/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_wardrobe_item(
    item_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    item = _get_owned_wardrobe_item(db, owner_id=current_user.id, item_id=item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wardrobe item not found")
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
