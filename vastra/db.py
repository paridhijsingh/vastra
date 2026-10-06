"""SQLAlchemy engine and session helpers."""

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from vastra.config import get_settings

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


class Base(DeclarativeBase):
    pass


def _sqlite_path_from_url(url: str) -> Path | None:
    if not url.startswith("sqlite:///"):
        return None
    raw = url.removeprefix("sqlite:///")
    if raw in {"", ":memory:"} or raw.startswith("file:"):
        return None
    return Path(raw)


def ensure_database_dir(url: str) -> None:
    """Create the parent directory for a file-backed SQLite database."""
    path = _sqlite_path_from_url(url)
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)


def get_engine() -> Engine:
    global _engine, _SessionLocal
    if _engine is None:
        settings = get_settings()
        ensure_database_dir(settings.database_url)
        connect_args: dict[str, object] = {}
        if settings.database_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(settings.database_url, connect_args=connect_args)

        @event.listens_for(_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:  # noqa: ANN001
            if settings.database_url.startswith("sqlite"):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _SessionLocal is not None
    return _SessionLocal


def init_db() -> None:
    """Create tables if they do not already exist. Does not drop existing data."""
    # Import models so metadata is registered before create_all.
    from vastra import models  # noqa: F401

    engine = get_engine()
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def reset_db_state() -> None:
    """Dispose the engine so the next call picks up new settings (tests)."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None
